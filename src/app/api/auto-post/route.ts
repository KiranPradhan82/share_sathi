import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchNepseData } from '@/lib/nepse';
import { formatMarketUpdate } from '@/lib/content-formatter';
import { postToFacebook } from '@/lib/facebook';
import { requireAuth } from '@/lib/require-auth';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

async function getConfigValue(key: string): Promise<string> {
  const config = await db.systemConfig.findUnique({ where: { key } });
  return config?.value || '';
}

/**
 * Get today's date in Nepal timezone (Asia/Kathmandu, UTC+5:45).
 */
function getNepalToday(): string {
  const now = new Date();
  const nepalStr = now.toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' });
  const nepalDate = new Date(nepalStr);
  return nepalDate.toISOString().split('T')[0];
}

/**
 * Fetch NEPSE data and verify the tradingDate matches today (Nepal time).
 * If YONEPSE returns yesterday's data, retries every 5 minutes up to maxAttempts.
 */
async function fetchWithTodayCheck(maxAttempts = 6, retryDelayMs = 300000): Promise<{
  nepseData: Awaited<ReturnType<typeof fetchNepseData>>;
  dateMatch: boolean;
  attempts: number;
  lastError: string | null;
}> {
  const todayNepal = getNepalToday();
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const data = await fetchNepseData();
      const dataDate = data.tradingDate;

      if (dataDate === todayNepal) {
        return { nepseData: data, dateMatch: true, attempts: attempt, lastError: null };
      }

      lastError = `YONEPSE returned data for ${dataDate}, but today (Nepal) is ${todayNepal}. Market data not yet updated.`;
      await db.systemEvent.create({
        data: {
          eventType: 'auto_post',
          entityType: 'market_data',
          description: `Auto-post attempt ${attempt}/${maxAttempts}: ${lastError} Retrying in ${retryDelayMs / 1000}s...`,
          severity: 'warning',
        },
      });

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Unknown fetch error';
      await db.systemEvent.create({
        data: {
          eventType: 'auto_post',
          entityType: 'market_data',
          description: `Auto-post attempt ${attempt}/${maxAttempts}: Fetch failed — ${lastError}. Retrying in ${retryDelayMs / 1000}s...`,
          severity: 'warning',
        },
      });

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  throw new Error(
    `Auto-post failed after ${maxAttempts} attempts. Could not get today's (${todayNepal}) data from YONEPSE.\n` +
    `Last error: ${lastError}`
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const isManual = body.manual === true;

    // Check if auto-post is enabled (skip check for manual trigger)
    if (!isManual) {
      const autoPostEnabled = await getConfigValue('auto_post_enabled');
      if (autoPostEnabled !== 'true') {
        return NextResponse.json({ success: false, message: 'Auto-post is disabled in settings' });
      }
    }

    // Check if already posted today
    const todayNepal = getNepalToday();
    const todayData = await db.marketData.findUnique({ where: { tradingDate: todayNepal } });
    if (todayData) {
      const alreadyPosted = await db.facebookPost.findFirst({
        where: { marketDataId: todayData.id, status: 'success' },
      });
      if (alreadyPosted) {
        return NextResponse.json({
          success: false,
          message: `Already posted for ${todayNepal}. Skipping duplicate.`,
          facebookPostId: alreadyPosted.facebookPostId,
        });
      }
    }

    // Get Facebook credentials
    const pageAccessToken = await getConfigValue('facebook_page_access_token');
    const pageId = await getConfigValue('facebook_page_id');
    if (!pageAccessToken || !pageId) {
      return NextResponse.json({ error: 'Facebook credentials not configured' }, { status: 400 });
    }

    // Fetch NEPSE data with today-check retry logic
    const { nepseData, dateMatch, attempts } = await fetchWithTodayCheck();

    if (!dateMatch) {
      return NextResponse.json({
        success: false,
        message: `Could not get today's data after ${attempts} attempts. YONEPSE may not have updated yet.`,
      });
    }

    // Upsert market data
    const marketData = await db.marketData.upsert({
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

    // Post text update to Facebook
    const message = formatMarketUpdate({
      tradingDate: marketData.tradingDate,
      nepseIndex: marketData.nepseIndex,
      change: marketData.change,
      changePercentage: marketData.changePercentage,
      turnover: marketData.turnover,
      volume: marketData.volume,
      trades: marketData.trades,
      gainers: marketData.gainers,
      losers: marketData.losers,
      unchanged: marketData.unchanged,
      rawData: marketData.rawData,
    });

    const fbPost = await db.facebookPost.create({
      data: {
        marketDataId: marketData.id,
        message: `[AUTO] ${message.substring(0, 100)}...`,
        status: 'posting',
        attemptCount: 1,
      },
    });

    await db.systemEvent.create({
      data: {
        eventType: 'auto_post',
        entityType: 'market_data',
        entityId: marketData.id,
        marketDataId: marketData.id,
        description: `Auto-post triggered for ${marketData.tradingDate} (took ${attempts} attempt(s) to get today's data). Index: ${marketData.nepseIndex}`,
        severity: 'info',
      },
    });

    const result = await postToFacebook(message, pageAccessToken, pageId);

    if (result.success) {
      await db.facebookPost.update({
        where: { id: fbPost.id },
        data: { status: 'success', facebookPostId: result.postId || null, postedTime: new Date() },
      });
      await db.systemEvent.create({
        data: {
          eventType: 'auto_post',
          entityType: 'facebook_post',
          entityId: fbPost.id,
          facebookPostId: fbPost.id,
          description: `Auto-post successful for ${marketData.tradingDate}. FB Post ID: ${result.postId}`,
          severity: 'success',
        },
      });

      return NextResponse.json({
        success: true,
        message: `Auto-posted market update for ${marketData.tradingDate} (${attempts} fetch attempt(s))`,
        facebookPostId: result.postId,
        attempts,
      });
    } else {
      await db.facebookPost.update({
        where: { id: fbPost.id },
        data: { status: 'failed', attemptCount: 1, errorMessage: result.error || 'Unknown error' },
      });
      await db.systemEvent.create({
        data: {
          eventType: 'auto_post',
          entityType: 'facebook_post',
          entityId: fbPost.id,
          facebookPostId: fbPost.id,
          description: `Auto-post failed for ${marketData.tradingDate}: ${result.error}`,
          severity: 'error',
        },
      });

      return NextResponse.json({ success: false, error: result.error, attempts }, { status: 500 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Auto-post failed';
    await db.systemEvent.create({
      data: {
        eventType: 'auto_post',
        entityType: 'system',
        description: `Auto-post pipeline failed: ${message}`,
        severity: 'error',
      },
    }).catch(() => {});

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// GET for health check
export async function GET() {
  return NextResponse.json({
    cron: 'active',
    purpose: 'NEPSE auto-post with today-data validation',
    timezone: 'Asia/Kathmandu',
    retryPolicy: '6 attempts, 5-minute intervals',
  });
}