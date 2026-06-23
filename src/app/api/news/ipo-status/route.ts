import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scrapeCdscIpoList } from '@/lib/cdsc-scraper';
import { scrapeShareSansarUpcoming, scrapeSebonPipeline } from '@/lib/upcoming-ipo-scraper';
import { requireAuth } from '@/lib/require-auth';

export const maxDuration = 60;

// Cache IPO data for 30 minutes — sources update slowly
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
              cdsc: parsed.cdsc,
              cdscCount: parsed.cdsc?.length ?? 0,
              upcoming: parsed.upcoming,
              upcomingCount: parsed.upcoming?.length ?? 0,
              sebonPipeline: parsed.sebonPipeline,
              sebonPipelineCount: parsed.sebonPipeline?.length ?? 0,
              fetchedAt: new Date(parsed.timestamp).toISOString(),
              cached: true,
              cacheAge: Math.round(age / 1000),
            });
          }
        } catch { /* corrupt cache, refetch */ }
      }
    }

    // Fetch all sources in parallel
    const [cdscItems, upcomingItems, sebonPipeline] = await Promise.allSettled([
      scrapeCdscIpoList().catch(e => { console.error('CDSC scrape error:', e.message); return []; }),
      scrapeShareSansarUpcoming().catch(e => { console.error('ShareSansar upcoming error:', e.message); return []; }),
      scrapeSebonPipeline().catch(e => { console.error('SEBON pipeline error:', e.message); return []; }),
    ]);

    const cdsc = cdscItems.status === 'fulfilled' ? cdscItems.value : [];
    const upcoming = upcomingItems.status === 'fulfilled' ? upcomingItems.value : [];
    const sebonPipelineData = sebonPipeline.status === 'fulfilled' ? sebonPipeline.value : [];

    // Update cache
    await db.systemConfig.upsert({
      where: { key: 'ipo_cache' },
      update: {
        value: JSON.stringify({ cdsc, upcoming, sebonPipeline: sebonPipelineData, timestamp: Date.now() }),
        updatedAt: new Date(),
      },
      create: {
        key: 'ipo_cache',
        value: JSON.stringify({ cdsc, upcoming, sebonPipeline: sebonPipelineData, timestamp: Date.now() }),
      },
    });

    return NextResponse.json({
      success: true,
      cdsc,
      cdscCount: cdsc.length,
      upcoming,
      upcomingCount: upcoming.length,
      sebonPipeline: sebonPipelineData,
      sebonPipelineCount: sebonPipelineData.length,
      fetchedAt: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error('IPO fetch error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch IPO data' },
      { status: 500 },
    );
  }
}