import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scrapeCdscIpoList } from '@/lib/cdsc-scraper';
import { requireAuth } from '@/lib/require-auth';

export const maxDuration = 30;

// Cache IPO data for 30 minutes — CDSC updates slowly
const CACHE_TTL_MS = 30 * 60 * 1000;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  try {
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

    // Check cache
    if (!forceRefresh) {
      const cached = await db.systemConfig.findUnique({ where: { key: 'ipo_cache' } });
      if (cached) {
        try {
          const parsed = JSON.parse(cached.value);
          const age = Date.now() - parsed.timestamp;
          if (age < CACHE_TTL_MS) {
            return NextResponse.json({
              success: true,
              data: parsed.data,
              count: parsed.data.length,
              fetchedAt: new Date(parsed.timestamp).toISOString(),
              cached: true,
              cacheAge: Math.round(age / 1000),
            });
          }
        } catch { /* corrupt cache, refetch */ }
      }
    }

    // Fetch fresh from CDSC
    const items = await scrapeCdscIpoList();

    // Update cache
    await db.systemConfig.upsert({
      where: { key: 'ipo_cache' },
      update: {
        value: JSON.stringify({ data: items, timestamp: Date.now() }),
        updatedAt: new Date(),
      },
      create: {
        key: 'ipo_cache',
        value: JSON.stringify({ data: items, timestamp: Date.now() }),
      },
    });

    return NextResponse.json({
      success: true,
      data: items,
      count: items.length,
      fetchedAt: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error('CDSC scrape error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to scrape CDSC' },
      { status: 500 },
    );
  }
}