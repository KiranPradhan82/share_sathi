import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchAllNews } from '@/lib/news-scraper';
import { requireAuth } from '@/lib/require-auth';
import ZAI from 'z-ai-web-dev-sdk';

export const maxDuration = 120;

async function generateSummary(headline: string, language: string): Promise<string> {
  const langInstruction = language === 'ne'
    ? 'Write the summary in Nepali (Devanagari script).'
    : 'Write the summary in English.';

  const systemPrompt = `You are a Nepali share market news assistant. Given a news headline, write a short 2-3 line summary that explains the key point clearly. ${langInstruction} Do NOT use the headline itself as the summary. Do NOT start with "Here is a summary" or similar. Just write the summary directly. Keep it factual and concise. Maximum 300 characters.`;

  // Try up to 2 times
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const zai = await ZAI.create();
      const response = await zai.chat.completions.create({
        model: 'glm-4-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: headline },
        ],
      });

      const summary = response.choices?.[0]?.message?.content?.trim() || '';
      const cleaned = summary
        .replace(/^#{1,3}\s+/gm, '')
        .replace(/^(here is|summary|the summary)[:\s]*/i, '')
        .trim()
        .substring(0, 350);

      if (cleaned.length > 10) return cleaned;
      console.warn(`AI summary attempt ${attempt} returned too short: "${cleaned}"`);
    } catch (e) {
      console.error(`AI summary attempt ${attempt} failed for headline: "${headline.substring(0, 60)}"`, e);
    }
  }
  return '';
}

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

    // 2. Get the most recent publishedAt we have (to know if there's anything newer)
    const latestItem = await db.newsItem.findFirst({
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true },
    });

    // 3. Scrape all sources (needed to discover new items)
    const { items, sourceStats, errors } = await fetchAllNews({ fetchSummaries: false });

    // 4. Filter to only NEW items not already in DB (from last 24h)
    const newItems = items.filter(item => !existingIds.has(item.id));

    // 5. Also skip items older than our newest existing item (they're stale)
    let cutoffSkipped = 0;
    const trulyNew = newItems.filter(item => {
      if (latestItem) {
        const itemDate = new Date(item.publishedAt).getTime();
        const latestDate = latestItem.publishedAt.getTime();
        if (itemDate < latestDate - 60 * 1000) { // 1min tolerance
          cutoffSkipped++;
          return false;
        }
      }
      return true;
    });

    // 6. Generate AI summaries for all new items (parallel, with concurrency limit of 3)
    let addedCount = 0;
    let summaryGenerated = 0;
    let summaryFailed = 0;
    const dbErrors: string[] = [];
    const CONCURRENCY = 3;

    for (let i = 0; i < trulyNew.length; i += CONCURRENCY) {
      const batch = trulyNew.slice(i, i + CONCURRENCY);

      const results = await Promise.allSettled(
        batch.map(async (item) => {
          const pubDate = new Date(item.publishedAt);
          if (isNaN(pubDate.getTime())) return null;

          // Generate AI summary for this headline
          const summary = await generateSummary(item.headline, item.language);

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
            summaryGenerated++;
          } else {
            summaryFailed++;
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
        description: `News fetch: ${items.length} scraped, ${addedCount} new, ${totalSkipped} existing/stale. AI summaries: ${summaryGenerated} ok, ${summaryFailed} failed.${cleanupInfo}`,
        severity: addedCount > 0 ? 'success' : 'info',
        metadata: JSON.stringify({ sourceStats, errors, cutoffSkipped, summaryGenerated, summaryFailed, deletedOld: deletedCount.count }),
      },
    });

    return NextResponse.json({
      success: true,
      totalScraped: items.length,
      added: addedCount,
      skipped: totalSkipped,
      summaryGenerated,
      summaryFailed,
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