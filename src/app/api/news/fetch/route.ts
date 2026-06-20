import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchAllNews } from '@/lib/news-scraper';
import { requireAuth } from '@/lib/require-auth';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  try {
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

    // 6. Save only truly new items
    let addedCount = 0;
    const dbErrors: string[] = [];

    for (const item of trulyNew) {
      try {
        const pubDate = new Date(item.publishedAt);
        if (isNaN(pubDate.getTime())) {
          continue;
        }
        await db.newsItem.create({
          data: {
            externalId: item.id,
            source: item.source,
            headline: item.headline,
            summary: '',
            category: item.category,
            language: item.language,
            publishedAt: pubDate,
          },
        });
        addedCount++;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error(`Failed to create news item ${item.id}: ${errMsg}`);
        dbErrors.push(`${item.source}: ${errMsg}`);
      }
    }

    const totalSkipped = items.length - addedCount;

    await db.systemEvent.create({
      data: {
        eventType: 'fetch',
        entityType: 'news',
        description: `News fetch: ${items.length} scraped, ${addedCount} new, ${totalSkipped} existing/stale`,
        severity: addedCount > 0 ? 'success' : 'info',
        metadata: JSON.stringify({ sourceStats, errors, cutoffSkipped }),
      },
    });

    return NextResponse.json({
      success: true,
      totalScraped: items.length,
      added: addedCount,
      skipped: totalSkipped,
      sourceStats,
      errors: errors.length > 0 ? errors : undefined,
      dbErrors: dbErrors.length > 0 ? dbErrors : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch news';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}