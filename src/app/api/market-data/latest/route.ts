import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  try {
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

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching latest market data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch latest market data' },
      { status: 500 },
    );
  }
}