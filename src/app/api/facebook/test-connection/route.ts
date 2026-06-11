import { NextRequest, NextResponse } from 'next/server';
import { testConnection } from '@/lib/facebook';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pageId, pageAccessToken } = body;

    if (!pageId || !pageAccessToken) {
      return NextResponse.json(
        { success: false, error: 'Page ID and Access Token are required' },
        { status: 400 },
      );
    }

    const result = await testConnection(pageAccessToken, pageId);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Test failed',
      },
      { status: 500 },
    );
  }
}