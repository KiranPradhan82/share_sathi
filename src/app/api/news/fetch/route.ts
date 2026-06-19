import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchAllNews } from '@/lib/news-scraper';
import { requireAuth } from '@/lib/require-auth';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const fetchSummaries = body.fetchSummaries === true;

    const { items, sourceStats, errors } = await fetchAllNews({ fetchSummaries });

    // Upsert to database — only add new items (dedup by externalId)
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const dbErrors: string[] = [];

    for (const item of items) {
      try {
        // Validate publishedAt is a valid date
        const pubDate = new Date(item.publishedAt);
        if (isNaN(pubDate.getTime())) {
          console.warn(`Skipping news item with invalid publishedAt: ${item.id} (${item.publishedAt})`);
          skippedCount++;
          continue;
        }

        const existing = await db.newsItem.findUnique({ where: { externalId: item.id } });
        if (existing) {
          // Update summary if we now have one and didn't before
          if (item.summary && !existing.summary) {
            await db.newsItem.update({
              where: { id: existing.id },
              data: { summary: item.summary, fetchedAt: new Date() },
            });
            updatedCount++;
          } else {
            skippedCount++;
          }
        } else {
          await db.newsItem.create({
            data: {
              externalId: item.id,
              source: item.source,
              headline: item.headline,
              summary: item.summary,
              category: item.category,
              language: item.language,
              publishedAt: pubDate,
            },
          });
          addedCount++;
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error(`Failed to upsert news item ${item.id}: ${errMsg}`);
        dbErrors.push(`${item.source}: ${errMsg}`);
        // Unique constraint violation — skip
        skippedCount++;
      }
    }

    await db.systemEvent.create({
      data: {
        eventType: 'fetch',
        entityType: 'news',
        description: `Fetched ${items.length} news items from ${Object.keys(sourceStats).length} sources. Added: ${addedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`,
        severity: 'success',
        metadata: JSON.stringify({ sourceStats, errors }),
      },
    });

    return NextResponse.json({
      success: true,
      totalFetched: items.length,
      added: addedCount,
      updated: updatedCount,
      skipped: skippedCount,
      sourceStats,
      errors: errors.length > 0 ? errors : undefined,
      dbErrors: dbErrors.length > 0 ? dbErrors : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch news';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}