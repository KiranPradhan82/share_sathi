import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchNepseData } from '@/lib/nepse';
import { formatMarketUpdate } from '@/lib/content-formatter';

export async function POST() {
  try {
    const today = new Date().toISOString().split('T')[0];
    let existing = await db.marketData.findUnique({ where: { tradingDate: today } });

    if (!existing) {
      const nepseData = await fetchNepseData();

      // Determine source from rawData
      let source = 'unknown';
      try {
        const raw = JSON.parse(nepseData.rawData);
        source = raw.source || 'unknown';
      } catch {
        source = 'parsed-data';
      }

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
          description: `Fetched NEPSE data for ${existing.tradingDate} [source: ${source}]. Index: ${existing.nepseIndex}, Turnover: ${existing.turnover}, Shares: ${existing.volume}`,
          severity: source === 'mock' ? 'warning' : 'success',
        },
      });
    }

    // Determine source from DB rawData (it's stored as JSON string)
    let source = 'NEPSE Data';
    try {
      const raw = JSON.parse(existing.rawData);
      source = raw.source === 'mock' ? 'MOCK DATA (all sources failed)' :
               raw.source === 'yonepse' ? 'YONEPSE API (real data)' :
               raw.source === 'nepse-website' ? 'NEPSE Website (scraped)' :
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
      isMock: source.includes('MOCK'),
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