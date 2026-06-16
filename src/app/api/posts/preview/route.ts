import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchNepseData } from '@/lib/nepse';
import { formatMarketUpdate } from '@/lib/content-formatter';
import { requireAuth } from '@/lib/require-auth';

const marketDataFields = {
  nepseIndex: true, change: true, changePercentage: true,
  turnover: true, volume: true, trades: true,
  gainers: true, losers: true, unchanged: true,
  rawData: true, status: true,
} as const;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  try {
    const today = new Date().toISOString().split('T')[0];
    let existing = await db.marketData.findUnique({ where: { tradingDate: today } });

    // Parse query params for force refresh
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('force') === 'true';

    if (!existing || forceRefresh) {
      const nepseData = await fetchNepseData();

      let source = 'unknown';
      try {
        const raw = JSON.parse(nepseData.rawData);
        source = raw.source || 'unknown';
      } catch {
        source = 'parsed-data';
      }

      const upsertData = {
        tradingDate: nepseData.tradingDate,
        nepseIndex: nepseData.nepseIndex,
        change: nepseData.change,
        changePercentage: nepseData.changePercentage,
        turnover: nepseData.turnover,
        volume: nepseData.volume,
        trades: nepseData.trades,
        gainers: nepseData.gainers,
        losers: nepseData.losers,
        unchanged: nepseData.unchanged,
        rawData: nepseData.rawData,
        status: 'completed' as const,
      };

      if (existing && forceRefresh) {
        existing = await db.marketData.update({
          where: { id: existing.id },
          data: upsertData,
        });
      } else {
        existing = await db.marketData.upsert({
          where: { tradingDate: nepseData.tradingDate },
          update: upsertData,
          create: upsertData,
        });
      }

      await db.systemEvent.create({
        data: {
          eventType: 'fetch',
          entityType: 'market_data',
          entityId: existing.id,
          marketDataId: existing.id,
          description: `Fetched NEPSE data for ${existing.tradingDate} [source: ${source}]. Index: ${existing.nepseIndex}, Turnover: ${existing.turnover}, Shares: ${existing.volume}`,
          severity: 'success',
        },
      });
    }

    // Determine source label from rawData
    let source = 'NEPSE Data';
    try {
      const raw = JSON.parse(existing.rawData);
      source = raw.source === 'yonepse' ? 'YONEPSE API' :
               raw.source === 'nepse-api' ? 'NEPSE API' : 'NEPSE Data';
    } catch {
      source = 'NEPSE Data (cached)';
    }

    // Format the post
    const message = formatMarketUpdate({
      tradingDate: existing.tradingDate,
      nepseIndex: existing.nepseIndex,
      change: existing.change,
      changePercentage: existing.changePercentage,
      turnover: existing.turnover,
      volume: existing.volume,
      trades: existing.trades,
      gainers: existing.gainers,
      losers: existing.losers,
      unchanged: existing.unchanged,
      rawData: existing.rawData,
    });

    return NextResponse.json({
      success: true,
      marketData: existing,
      previewMessage: message,
      source,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch data';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}