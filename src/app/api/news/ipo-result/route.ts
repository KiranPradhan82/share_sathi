import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchIpoResultNews } from '@/lib/news-scraper';
import { requireAuth } from '@/lib/require-auth';
import ZAI from 'z-ai-web-dev-sdk';

export const maxDuration = 60;

async function generateSummary(headline: string, language: string): Promise<string> {
  const langInstruction = language === 'ne'
    ? 'Write the summary in Nepali (Devanagari script).'
    : 'Write the summary in English.';
  try {
    const zai = await ZAI.create();
    const response = await zai.chat.completions.create({
      model: 'glm-4-flash',
      messages: [
        { role: 'system', content: `You are a Nepali share market news assistant. Given an IPO result news headline, write a short 2-3 line summary. ${langInstruction} Do NOT use the headline itself as the summary. Just write the summary directly. Maximum 300 characters.` },
        { role: 'user', content: headline },
      ],
    });
    const summary = response.choices?.[0]?.message?.content?.trim() || '';
    return summary.replace(/^#{1,3}\s+/gm, '').replace(/^(here is|summary|the summary)[:\s]*/i, '').trim().substring(0, 350);
  } catch (e) {
    console.error('AI summary failed for IPO result:', e);
    return '';
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  try {
    const existingItems = await db.newsItem.findMany({
      where: { source: 'sharesansar', category: 'ipo' },
      select: { externalId: true },
    });
    const existingIds = new Set(existingItems.map(i => i.externalId));

    const { items, errors } = await fetchIpoResultNews();
    const newItems = items.filter(item => !existingIds.has(item.id));

    let addedCount = 0;
    let summaryGenerated = 0;
    const CONCURRENCY = 3;

    for (let i = 0; i < newItems.length; i += CONCURRENCY) {
      const batch = newItems.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (item) => {
          const pubDate = new Date(item.publishedAt);
          if (isNaN(pubDate.getTime())) return null;
          const summary = await generateSummary(item.headline, item.language);
          await db.newsItem.create({
            data: {
              externalId: item.id,
              source: item.source,
              headline: item.headline,
              summary,
              category: 'ipo',
              language: item.language,
              publishedAt: pubDate,
            },
          });
          return { summary };
        })
      );
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          addedCount++;
          if (result.value.summary) summaryGenerated++;
        }
      }
    }

    await db.systemEvent.create({
      data: {
        eventType: 'fetch',
        entityType: 'ipo_result_news',
        description: `IPO result news: ${items.length} scraped, ${addedCount} new. Summaries: ${summaryGenerated}.`,
        severity: addedCount > 0 ? 'success' : 'info',
        metadata: JSON.stringify({ totalScraped: items.length, added: addedCount, summaryGenerated, errors }),
      },
    });

    return NextResponse.json({ success: true, totalScraped: items.length, added: addedCount, summaryGenerated, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch IPO result news';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}