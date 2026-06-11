import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30', 10);
    const status = searchParams.get('status') || 'all';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const where: Record<string, unknown> = {};
    if (status !== 'all') {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      db.marketData.findMany({
        where,
        orderBy: { tradingDate: 'desc' },
        skip: (page - 1) * limit,
        take: Math.min(limit, days),
      }),
      db.marketData.count({ where }),
    ]);

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching market data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market data' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { tradingDate, nepseIndex, change, changePercentage, turnover, volume, trades, gainers, losers, unchanged, rawData, status } = body;

    if (!tradingDate || nepseIndex === undefined) {
      return NextResponse.json(
        { error: 'tradingDate and nepseIndex are required' },
        { status: 400 },
      );
    }

    // Check for existing entry
    const existing = await db.marketData.findUnique({
      where: { tradingDate },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Data for this date already exists', data: existing },
        { status: 409 },
      );
    }

    const data = await db.marketData.create({
      data: {
        tradingDate,
        nepseIndex: parseFloat(nepseIndex),
        change: parseFloat(change || 0),
        changePercentage: parseFloat(changePercentage || 0),
        turnover: parseFloat(turnover || 0),
        volume: parseFloat(volume || 0),
        trades: parseInt(trades || 0, 10),
        gainers: parseInt(gainers || 0, 10),
        losers: parseInt(losers || 0, 10),
        unchanged: parseInt(unchanged || 0, 10),
        rawData: rawData || '{}',
        status: status || 'completed',
      },
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error creating market data:', error);
    return NextResponse.json(
      { error: 'Failed to create market data' },
      { status: 500 },
    );
  }
}