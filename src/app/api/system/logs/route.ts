import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const severity = searchParams.get('severity') || 'all';
    const eventType = searchParams.get('eventType') || 'all';

    const where: Record<string, unknown> = {};
    if (severity !== 'all') {
      where.severity = severity;
    }
    if (eventType !== 'all') {
      where.eventType = eventType;
    }

    const [data, total] = await Promise.all([
      db.systemEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.systemEvent.count({ where }),
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
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch logs' },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    await db.systemEvent.deleteMany({});
    return NextResponse.json({ message: 'All logs cleared' });
  } catch (error) {
    console.error('Error clearing logs:', error);
    return NextResponse.json(
      { error: 'Failed to clear logs' },
      { status: 500 },
    );
  }
}