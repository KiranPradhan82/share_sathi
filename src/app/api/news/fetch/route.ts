import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchAllNews, fetchArticleSummary } from '@/lib/news-scraper';
import { requireAuth } from '@/lib/require-auth';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  try {
    // 0. Auto-delete news older than 7 days
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const deletedCount = await db.newsItem.deleteMany({
      where: { publishedAt: { lt: oneWeekAgo } },
    });
    if (deletedCount.count > 0) {
      console.log(`Auto-cleaned ${deletedCount.count} news items older than 7 days`);
    }

    // 1. Get existing externalIds from the last 24h to pre-filter
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentItems = await db.newsItem.findMany({
      where: { fetchedAt: { gte: oneDayAgo } },
      select: { externalId: true },
    });
    const existingIds = new Set(recentItems.map(i => i.externalId));

    // 2. Get the most recent publishedAt we have
    const latestItem = await db.newsItem.findFirst({
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true },
    });

    // 3. Scrape all sources
    const { items, sourceStats, errors } = await fetchAllNews();

    // 4. Filter to only NEW items
    const newItems = items.filter(item => !existingIds.has(item.id));

    // 5. Skip items older than our newest existing item
    let cutoffSkipped = 0;
    const trulyNew = newItems.filter(item => {
      if (latestItem) {
        const itemDate = new Date(item.publishedAt).getTime();
        const latestDate = latestItem.publishedAt.getTime();
        if (itemDate < latestDate - 60 * 1000) {
          cutoffSkipped++;
          return false;
        }
      }
      return true;
    });

    // 6. Fetch article summaries for items that need them (parallel, concurrency 3)
    let addedCount = 0;
    let summaryFetched = 0;
    let summarySkipped = 0; // RSS items that already have summaries
    const dbErrors: string[] = [];
    const CONCURRENCY = 3;

    for (let i = 0; i < trulyNew.length; i += CONCURRENCY) {
      const batch = trulyNew.slice(i, i + CONCURRENCY);

      const results = await Promise.allSettled(
        batch.map(async (item) => {
          const pubDate = new Date(item.publishedAt);
          if (isNaN(pubDate.getTime())) return null;

          let summary = item.summary || '';

          // If no summary yet, fetch from article page
          if (!summary && item.url) {
            summary = await fetchArticleSummary(item.url, item.source);
          }

          // SEBON items get a generic summary
          if (!summary && item.source === 'sebon') {
            summary = 'SEBON notice — see details on SEBON website.';
          }

          const created = await db.newsItem.create({
            data: {
              externalId: item.id,
              source: item.source,
              headline: item.headline,
              summary,
              category: item.category,
              language: item.language,
              publishedAt: pubDate,
            },
          });

          return { item, summary, created };
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          addedCount++;
          if (result.value.summary) {
            if (result.value.item.summary) {
              summarySkipped++; // Came with summary (RSS)
            } else {
              summaryFetched++; // We fetched from article
            }
          }
        } else if (result.status === 'rejected') {
          const errMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
          console.error('Failed to process news item in batch:', errMsg);
          dbErrors.push(errMsg);
        }
      }
    }

    const totalSkipped = items.length - addedCount;

    const cleanupInfo = deletedCount.count > 0 ? ` Cleaned ${deletedCount.count} items older than 7 days.` : '';

    await db.systemEvent.create({
      data: {
        eventType: 'fetch',
        entityType: 'news',
        description: `News fetch: ${items.length} scraped, ${addedCount} new, ${totalSkipped} existing/stale. Summaries: ${summaryFetched} fetched, ${summarySkipped} from RSS.${cleanupInfo}`,
        severity: addedCount > 0 ? 'success' : 'info',
        metadata: JSON.stringify({ sourceStats, errors, cutoffSkipped, summaryFetched, summarySkipped, deletedOld: deletedCount.count }),
      },
    });

    return NextResponse.json({
      success: true,
      totalScraped: items.length,
      added: addedCount,
      skipped: totalSkipped,
      summaryFetched,
      summarySkipped,
      deletedOld: deletedCount.count || undefined,
      sourceStats,
      errors: errors.length > 0 ? errors : undefined,
      dbErrors: dbErrors.length > 0 ? dbErrors : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch news';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}