import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchNepseData } from '@/lib/nepse';
import { formatMarketUpdate } from '@/lib/content-formatter';

export async function POST() {
  try {
    // Check if we already have today's data
    const today = new Date().toISOString().split('T')[0];
    let existing = await db.marketData.findUnique({ where: { tradingDate: today } });

    if (!existing) {
      // Fetch from NEPSE API
      const nepseData = await fetchNepseData();

      existing = await db.marketData.create({
        data: {
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
          status: 'completed',
        },
      });

      await db.systemEvent.create({
        data: {
          eventType: 'fetch',
          entityType: 'market_data',
          entityId: existing.id,
          marketDataId: existing.id,
          description: `Fetched NEPSE data for ${existing.tradingDate}. Index: ${existing.nepseIndex}`,
          severity: 'success',
        },
      });
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
      source: existing.rawData?.source || 'NEPSE API',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch data',
      },
      { status: 500 },
    );
  }
}