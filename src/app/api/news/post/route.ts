import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { postToFacebook } from '@/lib/facebook';
import { requireAuth } from '@/lib/require-auth';

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
    const { newsId, headline, summary, customMessage } = body;

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

    // Build message
    const headlineText = headline || newsItem.headline;
    let summaryText = (summary || newsItem.summary || '').trim();

    // Clean up garbage summaries from bad scrapes
    summaryText = summaryText
      .replace(/^merolagani\s*[-–—]\s*/i, '')
      .replace(/^sharesansar\s*[-–—]\s*/i, '')
      .replace(/We'd like to send you notifications[\s\S]*/gi, '')
      .replace(/Subscribe[\s\S]*?newsletter/gi, '')
      .trim();

    // Skip summary if it's too similar to headline (>60% character overlap)
    if (summaryText) {
      const h = headlineText.toLowerCase().replace(/\s+/g, '');
      const s = summaryText.toLowerCase().replace(/\s+/g, '');
      let matchCount = 0;
      for (let i = 0; i < Math.min(h.length, s.length); i++) {
        if (s.includes(h.substring(i, i + 10))) matchCount++;
      }
      if (matchCount > 3 || s.includes(h) || h.includes(s)) {
        summaryText = '';
      }
    }

    const sourceLabel = newsItem.source === 'merolagani' ? 'Mero Lagani' :
                        newsItem.source === 'sharesansar' ? 'Share Sansar' :
                        newsItem.source === 'sebon' ? 'SEBON' :
                        newsItem.source === 'google_news' ? 'Google News' :
                        newsItem.source === 'myrepublica' ? 'My Republica' : newsItem.source;

    let message = customMessage || `📰 ${headlineText}`;
    if (summaryText && summaryText.length > 20) {
      message += `\n\n${summaryText}`;
    }
    message += `\n\n📡 Source: ${sourceLabel}`;
    message += `\n\n#NEPSE #ShareSathi #NepalStockMarket #ShareMarket`;

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
          description: `Posted news to Facebook: "${headlineText.substring(0, 80)}". FB Post ID: ${result.postId}`,
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
    const message = error instanceof Error ? error.message : 'Failed to post news';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}