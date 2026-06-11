import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchNepseData } from '@/lib/nepse';

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date') || undefined;

    // Fetch NEPSE data
    const nepseData = await fetchNepseData(date);

    // Check for existing entry
    const existing = await db.marketData.findUnique({
      where: { tradingDate: nepseData.tradingDate },
    });

    if (existing) {
      await db.systemEvent.create({
        data: {
          eventType: 'fetch',
          entityType: 'market_data',
          entityId: existing.id,
          description: `Market data for ${nepseData.tradingDate} already exists. Skipped fetch.`,
          severity: 'info',
        },
      });

      return NextResponse.json({
        data: existing,
        message: 'Data for this date already exists',
      });
    }

    // Create new market data entry
    const data = await db.marketData.create({
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

    // Log the event
    await db.systemEvent.create({
      data: {
        eventType: 'fetch',
        entityType: 'market_data',
        entityId: data.id,
        marketDataId: data.id,
        description: `Successfully fetched NEPSE market data for ${nepseData.tradingDate}. Index: ${nepseData.nepseIndex}`,
        severity: 'success',
      },
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error fetching NEPSE data:', error);

    await db.systemEvent.create({
      data: {
        eventType: 'fetch',
        entityType: 'market_data',
        description: `Failed to fetch NEPSE data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
      },
    }).catch(() => { /* ignore log failure */ });

    return NextResponse.json(
      { error: 'Failed to fetch NEPSE data' },
      { status: 500 },
    );
  }
}