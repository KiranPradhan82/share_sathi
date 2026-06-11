import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

async function getConfigValue(key: string): Promise<string> {
  const config = await db.systemConfig.findUnique({ where: { key } });
  return config?.value || '';
}

export async function GET() {
  try {
    const [lastFetch, lastPost, totalPosts, successPosts, failedPosts, recentEvents, configs] =
      await Promise.all([
        db.marketData.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, tradingDate: true },
        }),
        db.facebookPost.findFirst({
          where: { status: 'success' },
          orderBy: { postedTime: 'desc' },
          select: { postedTime: true },
        }),
        db.facebookPost.count(),
        db.facebookPost.count({ where: { status: 'success' } }),
        db.facebookPost.count({ where: { status: 'failed' } }),
        db.systemEvent.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { eventType: true, description: true, severity: true, createdAt: true },
        }),
        db.systemConfig.findMany({
          select: { key: true, value: true },
        }),
      ]);

    const successRate = totalPosts > 0 ? ((successPosts / totalPosts) * 100).toFixed(1) : '0';

    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.key] = c.value;
    }

    return NextResponse.json({
      status: 'online',
      lastFetch: lastFetch?.createdAt || null,
      lastFetchDate: lastFetch?.tradingDate || null,
      lastPost: lastPost?.postedTime || null,
      totalPosts,
      successPosts,
      failedPosts,
      successRate: parseFloat(successRate),
      recentEvents,
      configuration: {
        facebookConfigured: !!(configMap.facebook_page_id && configMap.facebook_page_access_token),
        autoPostEnabled: configMap.auto_post_enabled === 'true',
        postTime: configMap.post_time || '15:00',
        language: configMap.language || 'en',
      },
    });
  } catch (error) {
    console.error('Error fetching system status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system status' },
      { status: 500 },
    );
  }
}