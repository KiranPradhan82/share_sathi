import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchNepseData } from '@/lib/nepse';
import { formatMarketUpdate } from '@/lib/content-formatter';
import { postToFacebook } from '@/lib/facebook';

async function getConfigValue(key: string): Promise<string> {
  const config = await db.systemConfig.findUnique({ where: { key } });
  return config?.value || '';
}

export async function POST(request: NextRequest) {
  try {
    let date: string | undefined;
    try {
      const body = await request.json();
      date = body.date || undefined;
    } catch {
      date = undefined;
    }

    // Step 1: Fetch NEPSE data
    let marketData = date
      ? await db.marketData.findUnique({ where: { tradingDate: date } })
      : await db.marketData.findFirst({ orderBy: { tradingDate: 'desc' } });

    if (!marketData) {
      const nepseData = await fetchNepseData(date);

      marketData = await db.marketData.create({
        data: {
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

      await db.systemEvent.create({
        data: {
          eventType: 'fetch',
          entityType: 'market_data',
          entityId: marketData.id,
          marketDataId: marketData.id,
          description: `Fetched NEPSE data for ${marketData.tradingDate} as part of manual pipeline. Index: ${marketData.nepseIndex}`,
          severity: 'success',
        },
      });
    }

    // Step 2: Format content
    const nepseDataForFormat = {
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
    };

    const message = formatMarketUpdate(nepseDataForFormat);

    // Step 3: Get Facebook credentials
    const pageAccessToken = await getConfigValue('facebook_page_access_token');
    const pageId = await getConfigValue('facebook_page_id');

    // Step 4: Create Facebook post record
    const fbPost = await db.facebookPost.create({
      data: {
        marketDataId: marketData.id,
        message,
        status: 'posting',
        attemptCount: 1,
      },
    });

    await db.systemEvent.create({
      data: {
        eventType: 'post',
        entityType: 'facebook_post',
        entityId: fbPost.id,
        facebookPostId: fbPost.id,
        description: `Attempting to post market update for ${marketData.tradingDate} to Facebook.`,
        severity: 'info',
      },
    });

    // Step 5: Post to Facebook
    const result = await postToFacebook(message, pageAccessToken, pageId);

    if (result.success) {
      await db.facebookPost.update({
        where: { id: fbPost.id },
        data: {
          status: 'success',
          facebookPostId: result.postId || null,
          postedTime: new Date(),
        },
      });

      await db.systemEvent.create({
        data: {
          eventType: 'post',
          entityType: 'facebook_post',
          entityId: fbPost.id,
          facebookPostId: fbPost.id,
          description: `Successfully posted market update for ${marketData.tradingDate}. Facebook Post ID: ${result.postId}`,
          severity: 'success',
        },
      });
    } else {
      await db.facebookPost.update({
        where: { id: fbPost.id },
        data: {
          status: 'failed',
          attemptCount: 1,
          errorMessage: result.error || 'Unknown error',
        },
      });

      await db.systemEvent.create({
        data: {
          eventType: 'post',
          entityType: 'facebook_post',
          entityId: fbPost.id,
          facebookPostId: fbPost.id,
          description: `Failed to post market update for ${marketData.tradingDate}: ${result.error}`,
          severity: 'error',
        },
      });
    }

    // Return final result
    const updatedPost = await db.facebookPost.findUnique({
      where: { id: fbPost.id },
    });

    return NextResponse.json({
      success: result.success,
      marketData,
      post: updatedPost,
      message: result.success
        ? `Market update posted successfully for ${marketData.tradingDate}`
        : `Failed to post: ${result.error}`,
    });
  } catch (error) {
    console.error('Error in manual pipeline:', error);

    await db.systemEvent.create({
      data: {
        eventType: 'pipeline',
        description: `Manual pipeline failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
      },
    }).catch(() => { /* ignore */ });

    return NextResponse.json(
      { error: 'Pipeline failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}