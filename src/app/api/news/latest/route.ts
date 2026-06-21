import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const category = searchParams.get('category');
    const language = searchParams.get('language');
    const unpostedOnly = searchParams.get('unposted') === 'true';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (source) where.source = source;
    if (category) where.category = category;
    if (language) where.language = language;
    if (unpostedOnly) where.isPosted = false;

    const [items, total] = await Promise.all([
      db.newsItem.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      db.newsItem.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch news';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}