import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchNepseData } from '@/lib/nepse';
import { requireAuth } from '@/lib/require-auth';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  try {
    // Always try to get fresh data from source first
    let freshData = false;
    try {
      const nepseData = await fetchNepseData();
      if (nepseData) {
        await db.marketData.upsert({
          where: { tradingDate: nepseData.tradingDate },
          update: {
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
          create: {
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
        freshData = true;
      }
    } catch {
      // Source fetch failed — fall through to DB read
      console.log('Source fetch failed in /latest, falling back to DB');
    }

    // Return the most recent data from DB (whether fresh or cached)
    const data = await db.marketData.findFirst({
      orderBy: { tradingDate: 'desc' },
      include: {
        posts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!data) {
      return NextResponse.json({ data: null, message: 'No market data available' });
    }

    return NextResponse.json({ data, fresh: freshData });
  } catch (error) {
    console.error('Error fetching latest market data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch latest market data' },
      { status: 500 },
    );
  }
}