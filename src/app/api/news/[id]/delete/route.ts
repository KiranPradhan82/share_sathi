import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;

    const newsItem = await db.newsItem.findUnique({ where: { id } });
    if (!newsItem) {
      return NextResponse.json({ error: 'News item not found' }, { status: 404 });
    }

    const headline = newsItem.headline.substring(0, 80);

    await db.newsItem.delete({ where: { id } });

    await db.systemEvent.create({
      data: {
        eventType: 'delete',
        entityType: 'news',
        entityId: id,
        description: `Manually deleted news: "${headline}"`,
        severity: 'warning',
      },
    });

    return NextResponse.json({ success: true, message: 'News deleted' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete news';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}