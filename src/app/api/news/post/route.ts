import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { postToFacebook } from '@/lib/facebook';
import { requireAuth } from '@/lib/require-auth';
import { fetchArticleSummary } from '@/lib/news-scraper';

export const maxDuration = 60;

async function getConfigValue(key: string): Promise<string> {
  const config = await db.systemConfig.findUnique({ where: { key } });
  return config?.value || '';
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const { newsId, customMessage } = body;

    if (!newsId) {
      return NextResponse.json({ error: 'newsId is required' }, { status: 400 });
    }

    // Get news item
    const newsItem = await db.newsItem.findUnique({ where: { id: newsId } });
    if (!newsItem) {
      return NextResponse.json({ error: 'News item not found' }, { status: 404 });
    }

    // Get Facebook credentials
    const pageAccessToken = await getConfigValue('facebook_page_access_token');
    const pageId = await getConfigValue('facebook_page_id');
    if (!pageAccessToken || !pageId) {
      return NextResponse.json(
        { error: 'Facebook Page ID and Access Token are not configured.' },
        { status: 400 },
      );
    }

    const sourceLabel = newsItem.source === 'merolagani' ? 'Mero Lagani' :
                        newsItem.source === 'sharesansar' ? 'Share Sansar' :
                        newsItem.source === 'sebon' ? 'SEBON' :
                        newsItem.source === 'google_news' ? 'Google News' :
                        newsItem.source === 'myrepublica' ? 'My Republica' : newsItem.source;

    let message: string;

    if (customMessage) {
      message = customMessage;
    } else {
      let summary = newsItem.summary || '';

      // If no summary, try fetching article content now
      if (!summary.trim()) {
        console.log(`No summary for news ${newsId}, fetching article content...`);
        // Reconstruct URL based on source
        let articleUrl = '';
        if (newsItem.source === 'merolagani') {
          const idMatch = newsItem.externalId.match(/merolagani-(\d+)/);
          if (idMatch) articleUrl = `https://merolagani.com/NewsDetail.aspx?newsID=${idMatch[1]}`;
        } else if (newsItem.source === 'sharesansar') {
          const slugMatch = newsItem.externalId.match(/sharesansar-(.+)/);
          if (slugMatch) articleUrl = `https://www.sharesansar.com/newsdetail/${slugMatch[1]}`;
        }

        if (articleUrl) {
          summary = await fetchArticleSummary(articleUrl, newsItem.source);
          if (summary.trim()) {
            // Save it for next time
            await db.newsItem.update({
              where: { id: newsId },
              data: { summary: summary.trim() },
            });
          }
        }
      }

      // Build post message
      if (summary.trim() && summary.trim() !== 'SEBON notice — see details on SEBON website.') {
        message = `📰 ${newsItem.headline}\n\n${summary.trim()}\n\n📡 Source: ${sourceLabel}\n\n#NEPSE #ShareSathi #NepalStockMarket #ShareMarket`;
      } else {
        // Last resort: headline only with clear formatting
        message = `📰 ${newsItem.headline}\n\n📡 Source: ${sourceLabel}\n\n#NEPSE #ShareSathi #NepalStockMarket #ShareMarket`;
      }
    }

    // Post to Facebook
    const result = await postToFacebook(message, pageAccessToken, pageId);

    if (result.success) {
      await db.newsItem.update({
        where: { id: newsId },
        data: { isPosted: true, postedAt: new Date() },
      });

      await db.systemEvent.create({
        data: {
          eventType: 'post',
          entityType: 'news',
          entityId: newsId,
          description: `Posted news to Facebook: "${newsItem.headline.substring(0, 80)}". FB Post ID: ${result.postId}`,
          severity: 'success',
        },
      });

      return NextResponse.json({
        success: true,
        facebookPostId: result.postId,
        message: 'News posted to Facebook',
      });
    } else {
      await db.systemEvent.create({
        data: {
          eventType: 'post',
          entityType: 'news',
          entityId: newsId,
          description: `Failed to post news: ${result.error}`,
          severity: 'error',
        },
      });

      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Failed to post news';
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}