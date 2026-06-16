import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatMarketUpdate } from '@/lib/content-formatter';
import { requireAuth } from '@/lib/require-auth';

function generateHistoricalData(days: number) {
  const data: Array<{
    tradingDate: string;
    nepseIndex: number;
    change: number;
    changePercentage: number;
    turnover: number;
    volume: number;
    trades: number;
    gainers: number;
    losers: number;
    unchanged: number;
  }> = [];

  let currentIndex = 2265;
  const today = new Date();
  let tradingDays = 0;

  for (let i = days; i > 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Skip weekends (Saturday = 6, Sunday = 0 in JS)
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    tradingDays++;
    const variation = (Math.random() - 0.45) * 35;
    currentIndex = currentIndex + variation * 0.3;
    const change = parseFloat((variation * 0.3).toFixed(2));
    const changePercentage = parseFloat(((change / currentIndex) * 100).toFixed(2));
    const turnover = parseFloat((2.0 + Math.random() * 6.0).toFixed(2)) * 100000000;
    const volume = Math.floor(12000000 + Math.random() * 28000000);
    const trades = Math.floor(35000 + Math.random() * 35000);
    const totalListed = 220;
    const gainers = Math.floor(totalListed * (0.2 + Math.random() * 0.35));
    const losers = Math.floor(totalListed * (0.2 + Math.random() * 0.3));
    const unchanged = totalListed - gainers - losers;

    data.push({
      tradingDate: date.toISOString().split('T')[0],
      nepseIndex: parseFloat(currentIndex.toFixed(2)),
      change,
      changePercentage,
      turnover,
      volume,
      trades,
      gainers,
      losers,
      unchanged,
    });
  }

  return data;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;
  try {
    // Check if data already exists
    const existingCount = await db.marketData.count();
    if (existingCount > 0) {
      return NextResponse.json({
        message: `Database already has ${existingCount} entries. Skipping seed.`,
        seeded: false,
      });
    }

    const historicalData = generateHistoricalData(45);
    const createdMarketData = [];
    const createdPosts = [];
    const createdEvents = [];

    for (let i = 0; i < historicalData.length; i++) {
      const d = historicalData[i];

      // Create market data (use upsert for safety)
      const marketData = await db.marketData.upsert({
        where: { tradingDate: d.tradingDate },
        update: {
          nepseIndex: d.nepseIndex,
          change: d.change,
          changePercentage: d.changePercentage,
          turnover: d.turnover,
          volume: d.volume,
          trades: d.trades,
          gainers: d.gainers,
          losers: d.losers,
          unchanged: d.unchanged,
          rawData: JSON.stringify({ source: 'seed', generated: true }),
          status: 'completed',
        },
        create: {
          ...d,
          rawData: JSON.stringify({ source: 'seed', generated: true }),
          status: 'completed',
        },
      });
      createdMarketData.push(marketData);

      // Create Facebook post for most entries (skip a few recent ones)
      const isSuccess = Math.random() > 0.15; // 85% success rate
      const postMessage = formatMarketUpdate({
        tradingDate: d.tradingDate,
        nepseIndex: d.nepseIndex,
        change: d.change,
        changePercentage: d.changePercentage,
        turnover: d.turnover,
        volume: d.volume,
        trades: d.trades,
        gainers: d.gainers,
        losers: d.losers,
        unchanged: d.unchanged,
        rawData: '{}',
      });

      const postDate = new Date(d.tradingDate + 'T15:05:00');

      const post = await db.facebookPost.create({
        data: {
          marketDataId: marketData.id,
          facebookPostId: isSuccess ? `seed_post_${i}_${Date.now()}` : null,
          message: postMessage,
          status: isSuccess ? 'success' : 'failed',
          scheduledTime: postDate,
          postedTime: isSuccess ? postDate : null,
          attemptCount: isSuccess ? 1 : Math.floor(Math.random() * 3) + 1,
          errorMessage: !isSuccess ? 'Graph API error: Token expired or invalid permissions' : null,
        },
      });
      createdPosts.push(post);
    }

    // Create system events for demo
    const eventTypes = [
      { eventType: 'fetch', severity: 'success', description: 'Automatic market data fetch completed' },
      { eventType: 'post', severity: 'success', description: 'Market update posted to Facebook successfully' },
      { eventType: 'fetch', severity: 'info', description: 'Scheduled fetch initiated' },
      { eventType: 'config', severity: 'info', description: 'System settings updated' },
      { eventType: 'post', severity: 'warning', description: 'Post retry scheduled due to temporary failure' },
      { eventType: 'system', severity: 'info', description: 'Health check passed - all systems operational' },
    ];

    for (let i = 0; i < 20; i++) {
      const eventTemplate = eventTypes[i % eventTypes.length];
      const eventDate = new Date();
      eventDate.setHours(eventDate.getHours() - i * 3);

      const evt = await db.systemEvent.create({
        data: {
          ...eventTemplate,
          description: `[${eventDate.toISOString()}] ${eventTemplate.description}`,
          createdAt: eventDate,
        },
      });
      createdEvents.push(evt);
    }

    // Create default config
    await db.systemConfig.upsert({
      where: { key: 'facebook_page_id' },
      update: {},
      create: { key: 'facebook_page_id', value: '' },
    });
    await db.systemConfig.upsert({
      where: { key: 'facebook_page_access_token' },
      update: {},
      create: { key: 'facebook_page_access_token', value: '' },
    });
    await db.systemConfig.upsert({
      where: { key: 'auto_post_enabled' },
      update: {},
      create: { key: 'auto_post_enabled', value: 'false' },
    });
    await db.systemConfig.upsert({
      where: { key: 'post_time' },
      update: {},
      create: { key: 'post_time', value: '15:00' },
    });
    await db.systemConfig.upsert({
      where: { key: 'language' },
      update: {},
      create: { key: 'language', value: 'en' },
    });

    return NextResponse.json({
      message: `Seeded ${createdMarketData.length} market data entries, ${createdPosts.length} posts, and ${createdEvents.length} events.`,
      seeded: true,
      counts: {
        marketData: createdMarketData.length,
        posts: createdPosts.length,
        events: createdEvents.length,
      },
    });
  } catch (error) {
    console.error('Error seeding database:', error);
    return NextResponse.json(
      { error: 'Failed to seed database', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}