import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { postToFacebook } from '@/lib/facebook';
import { requireAuth } from '@/lib/require-auth';
import ZAI from 'z-ai-web-dev-sdk';

export const maxDuration = 60;

async function getConfigValue(key: string): Promise<string> {
  const config = await db.systemConfig.findUnique({ where: { key } });
  return config?.value || '';
}

async function generateSummary(headline: string, language: string): Promise<string> {
  try {
    const zai = await ZAI.create();
    const langInstruction = language === 'ne'
      ? 'Write the summary in Nepali (Devanagari script).'
      : 'Write the summary in English.';

    const response = await zai.chat.completions.create({
      model: 'glm-4-flash',
      messages: [
        {
          role: 'system',
          content: `You are a Nepali share market news assistant. Given a news headline, write a short 2-3 line summary that explains the key point clearly. ${langInstruction} Do NOT use the headline itself as the summary. Do NOT start with "Here is a summary" or similar. Just write the summary directly. Keep it factual and concise. Maximum 300 characters.`,
        },
        {
          role: 'user',
          content: headline,
        },
      ],
    });

    const summary = response.choices?.[0]?.message?.content?.trim() || '';
    // Clean up any markdown or preamble
    return summary
      .replace(/^#{1,3}\s+/gm, '')
      .replace(/^(here is|summary|the summary)[:\s]*/i, '')
      .trim()
      .substring(0, 350);
  } catch (e) {
    console.error('AI summary generation failed:', e);
    return '';
  }
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
    let aiSummary = '';

    if (customMessage) {
      message = customMessage;
    } else {
      // Generate AI summary for the headline
      aiSummary = await generateSummary(newsItem.headline, newsItem.language);

      // Save the generated summary to DB for reuse
      if (aiSummary) {
        await db.newsItem.update({
          where: { id: newsId },
          data: { summary: aiSummary },
        });
      }

      message = `📰 ${newsItem.headline}`;
      if (aiSummary) {
        message += `\n\n${aiSummary}`;
      }
      message += `\n\n📡 Source: ${sourceLabel}`;
      message += `\n\n#NEPSE #ShareSathi #NepalStockMarket #ShareMarket`;
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
        generatedSummary: aiSummary || undefined,
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