import { NextResponse } from 'next/server';
import { scrapeCdscIpoList } from '@/lib/cdsc-scraper';
import { requireAuth } from '@/lib/require-auth';

export const maxDuration = 30;

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  try {
    const items = await scrapeCdscIpoList();
    return NextResponse.json({ success: true, data: items, count: items.length, fetchedAt: new Date().toISOString() });
  } catch (error) {
    console.error('CDSC scrape error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to scrape CDSC' },
      { status: 500 },
    );
  }
}