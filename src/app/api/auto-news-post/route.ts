import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchAllNews, fetchArticleSummary } from '@/lib/news-scraper';
import { generateNewsCardImage } from '@/lib/news-card-generator';
import { formatNewsCardCaption } from '@/lib/content-formatter';
import { postPhotoToFacebook } from '@/lib/facebook-photo';
import { requireAuth } from '@/lib/require-auth';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

async function getConfigValue(key: string): Promise<string> {
  const config = await db.systemConfig.findUnique({ where: { key } });
  return config?.value || '';
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const isManual = body.manual === true;

    // Check if auto-news-post is enabled (skip check for manual trigger)
    if (!isManual) {
      const autoNewsPostEnabled = await getConfigValue('auto_news_post_enabled');
      if (autoNewsPostEnabled !== 'true') {
        return NextResponse.json({ success: false, message: 'Auto news post is disabled in settings' });
      }
    }

    // Get Facebook credentials
    const pageAccessToken = await getConfigValue('facebook_page_access_token');
    const pageId = await getConfigValue('facebook_page_id');
    if (!pageAccessToken || !pageId) {
      return NextResponse.json({ error: 'Facebook credentials not configured' }, { status: 400 });
    }

    // =============================================
    // PHASE 1: Fetch news from all sources
    // =============================================
    await db.systemEvent.create({
      data: {
        eventType: 'auto_news_post',
        entityType: 'news',
        description: 'Auto news post pipeline started. Phase 1: Fetching news from all sources...',
        severity: 'info',
      },
    });

    // Auto-delete news older than 7 days
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await db.newsItem.deleteMany({
      where: { publishedAt: { lt: oneWeekAgo } },
    });

    // Get existing externalIds from the last 24h for dedup
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentItems = await db.newsItem.findMany({
      where: { fetchedAt: { gte: oneDayAgo } },
      select: { externalId: true },
    });
    const existingIds = new Set(recentItems.map(i => i.externalId));

    // Get the most recent publishedAt we have
    const latestItem = await db.newsItem.findFirst({
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true },
    });

    // Scrape all sources
    const { items, sourceStats, errors: scrapeErrors } = await fetchAllNews();

    // Filter to only NEW items
    const newItems = items.filter(item => !existingIds.has(item.id));

    // Skip items older than our newest existing item
    const trulyNew = newItems.filter(item => {
      if (latestItem) {
        const itemDate = new Date(item.publishedAt).getTime();
        const latestDate = latestItem.publishedAt.getTime();
        if (itemDate < latestDate - 60 * 1000) return false;
      }
      return true;
    });

    if (trulyNew.length === 0) {
      await db.systemEvent.create({
        data: {
          eventType: 'auto_news_post',
          entityType: 'news',
          description: `No new news items found. Scraped ${items.length}, all were existing or stale.`,
          severity: 'info',
          metadata: JSON.stringify({ sourceStats }),
        },
      });
      return NextResponse.json({ success: true, message: 'No new news to post', totalScraped: items.length, newItems: 0, posted: 0 });
    }

    // Fetch article summaries for new items (concurrency 3)
    const CONCURRENCY = 3;
    const itemsWithSummaries: Array<{
      externalId: string;
      source: string;
      headline: string;
      summary: string;
      category: string;
      language: string;
      publishedAt: Date;
      url?: string;
    }> = [];

    for (let i = 0; i < trulyNew.length; i += CONCURRENCY) {
      const batch = trulyNew.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (item) => {
          const pubDate = new Date(item.publishedAt);
          if (isNaN(pubDate.getTime())) return null;

          let summary = item.summary || '';
          if (!summary && item.url) {
            summary = await fetchArticleSummary(item.url, item.source);
          }
          if (!summary && item.source === 'sebon') {
            summary = 'SEBON notice \u2014 see details on SEBON website.';
          }

          return {
            externalId: item.id,
            source: item.source,
            headline: item.headline,
            summary,
            category: item.category,
            language: item.language,
            publishedAt: pubDate,
            url: item.url,
          };
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          itemsWithSummaries.push(result.value);
        }
      }
    }

    await db.systemEvent.create({
      data: {
        eventType: 'auto_news_post',
        entityType: 'news',
        description: `Phase 1 complete: ${itemsWithSummaries.length} new items with summaries ready for posting.`,
        severity: 'info',
        metadata: JSON.stringify({ sourceStats, newTotal: itemsWithSummaries.length }),
      },
    });

    // =============================================
    // PHASE 2: Generate news card images & post to Facebook
    // =============================================
    await db.systemEvent.create({
      data: {
        eventType: 'auto_news_post',
        entityType: 'image',
        description: `Phase 2: Generating ${itemsWithSummaries.length} news card images and posting to Facebook...`,
        severity: 'info',
      },
    });

    const results: Array<{
      headline: string;
      source: string;
      success: boolean;
      postId?: string;
      error?: string;
      imageSize?: number;
    }> = [];

    for (let i = 0; i < itemsWithSummaries.length; i++) {
      const item = itemsWithSummaries[i];

      try {
        // Generate news card image server-side
        const imageBuffer = await generateNewsCardImage({
          headline: item.headline,
          summary: item.summary,
          source: item.source,
          category: item.category,
          publishedAt: item.publishedAt.toISOString(),
          language: item.language,
        });

        // Generate caption (headline as caption, summary in image)
        const caption = formatNewsCardCaption({
          headline: item.headline,
          source: item.source,
          category: item.category,
        });

        // 3-second delay between posts to avoid rate limiting
        if (i > 0) await delay(3000);

        // Post to Facebook
        const fbResult = await postPhotoToFacebook(imageBuffer, caption, pageAccessToken, pageId);

        if (fbResult.success) {
          // Mark as posted in DB (create or update the news item)
          await db.newsItem.upsert({
            where: { externalId: item.externalId },
            update: { isPosted: true, postedAt: new Date() },
            create: {
              externalId: item.externalId,
              source: item.source,
              headline: item.headline,
              summary: item.summary,
              category: item.category,
              language: item.language,
              publishedAt: item.publishedAt,
              isPosted: true,
              postedAt: new Date(),
            },
          });

          await db.systemEvent.create({
            data: {
              eventType: 'auto_news_post',
              entityType: 'facebook_post',
              description: `Posted news card: "${item.headline.substring(0, 60)}..." (${item.source}) - FB ID: ${fbResult.postId}`,
              severity: 'success',
            },
          });

          results.push({
            headline: item.headline,
            source: item.source,
            success: true,
            postId: fbResult.postId,
            imageSize: imageBuffer.length,
          });
        } else {
          // Still save the news item to DB even if posting failed
          await db.newsItem.upsert({
            where: { externalId: item.externalId },
            update: {},
            create: {
              externalId: item.externalId,
              source: item.source,
              headline: item.headline,
              summary: item.summary,
              category: item.category,
              language: item.language,
              publishedAt: item.publishedAt,
            },
          });

          await db.systemEvent.create({
            data: {
              eventType: 'auto_news_post',
              entityType: 'facebook_post',
              description: `Failed to post news card: "${item.headline.substring(0, 60)}..." - Error: ${fbResult.error}`,
              severity: 'error',
            },
          });

          results.push({
            headline: item.headline,
            source: item.source,
            success: false,
            error: fbResult.error,
          });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';

        // Save news item to DB even if image generation failed
        await db.newsItem.upsert({
          where: { externalId: item.externalId },
          update: {},
          create: {
            externalId: item.externalId,
            source: item.source,
            headline: item.headline,
            summary: item.summary,
            category: item.category,
            language: item.language,
            publishedAt: item.publishedAt,
          },
        });

        await db.systemEvent.create({
          data: {
            eventType: 'auto_news_post',
            entityType: 'image',
            description: `Image generation failed for "${item.headline.substring(0, 60)}..." - Error: ${errMsg}`,
            severity: 'error',
          },
        });

        results.push({
          headline: item.headline,
          source: item.source,
          success: false,
          error: errMsg,
        });
      }
    }

    // Also save any items we didn't get to (batch insert remaining)
    // (All items were processed in the loop above, this is just for safety)

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    await db.systemEvent.create({
      data: {
        eventType: 'auto_news_post',
        entityType: 'system',
        description: `Auto news post pipeline completed. Posted ${successCount}/${itemsWithSummaries.length} news cards. Failed: ${failedCount}.`,
        severity: successCount > 0 ? 'success' : 'warning',
        metadata: JSON.stringify({
          totalScraped: items.length,
          newItems: trulyNew.length,
          withSummaries: itemsWithSummaries.length,
          posted: successCount,
          failed: failedCount,
          sourceStats,
        }),
      },
    });

    return NextResponse.json({
      success: successCount > 0,
      message: `Auto-posted ${successCount}/${itemsWithSummaries.length} news cards`,
      totalScraped: items.length,
      newItems: trulyNew.length,
      processed: itemsWithSummaries.length,
      posted: successCount,
      failed: failedCount,
      results,
      scrapeErrors: scrapeErrors.length > 0 ? scrapeErrors : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Auto news post failed';
    await db.systemEvent.create({
      data: {
        eventType: 'auto_news_post',
        entityType: 'system',
        description: `Auto news post pipeline failed: ${message}`,
        severity: 'error',
      },
    }).catch(() => {});

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// GET for health check
export async function GET() {
  return NextResponse.json({
    cron: 'active',
    purpose: 'Auto-fetch news from 6 sources, generate news card images (headline + summary), post to Facebook',
    timezone: 'Asia/Kathmandu',
    schedule: '3:15 PM NPT (Sun-Thu)',
    pipeline: 'Fetch News (6 sources) -> Generate Card Images (Satori+resvg) -> Post to Facebook',
    sources: ['merolagani', 'sharesansar', 'sebon', 'google_news_en', 'google_news_ne', 'myrepublica'],
  });
}