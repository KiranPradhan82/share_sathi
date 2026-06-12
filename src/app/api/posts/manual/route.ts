import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchNepseData } from '@/lib/nepse';
import { formatMarketUpdate, formatImageCaption, formatGainersCaption, formatLosersCaption } from '@/lib/content-formatter';
import { postToFacebook } from '@/lib/facebook';
import { postPhotoToFacebook } from '@/lib/facebook-photo';
import { generateGainersLosers } from '@/lib/nepse-stocks';

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getConfigValue(key: string): Promise<string> {
  const config = await db.systemConfig.findUnique({ where: { key } });
  return config?.value || '';
}

// Convert a base64 data URI to a Buffer
function dataUriToBuffer(dataUri: string): Buffer {
  const base64 = dataUri.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64, 'base64');
}

export async function POST(request: NextRequest) {
  try {
    let date: string | undefined;
    let mode = 'image';
    let clientImages: Record<string, string> | null = null;

    try {
      const body = await request.json();
      date = body.date || undefined;
      mode = body.mode || 'image';
      clientImages = body.images || null;
    } catch {
      date = undefined;
    }

    // Step 1: Get market data
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

    // Step 2: Get Facebook credentials
    const pageAccessToken = await getConfigValue('facebook_page_access_token');
    const pageId = await getConfigValue('facebook_page_id');

    // Convert to NepseData format for captions
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

    // ---- IMAGE MODE ----
    if (mode === 'image') {
      // Use client-sent images if available (new flow)
      // Otherwise return error — server-side image generation removed
      if (!clientImages || !clientImages.marketSummary || !clientImages.topGainers || !clientImages.topLosers) {
        return NextResponse.json(
          { error: 'No images provided. Generate images in the browser first.' },
          { status: 400 },
        );
      }

      // Convert data URIs to buffers
      const imageBuffers = {
        marketSummary: dataUriToBuffer(clientImages.marketSummary),
        topGainers: dataUriToBuffer(clientImages.topGainers),
        topLosers: dataUriToBuffer(clientImages.topLosers),
      };

      // Validate buffers
      for (const [key, buf] of Object.entries(imageBuffers)) {
        if (buf.length < 100) {
          return NextResponse.json(
            { error: `Invalid ${key} image (size: ${buf.length} bytes)` },
            { status: 400 },
          );
        }
      }

      await db.systemEvent.create({
        data: {
          eventType: 'generate',
          entityType: 'image',
          description: `Received 3 client-generated images for ${marketData.tradingDate} (${Math.round(imageBuffers.marketSummary.length / 1024)}KB + ${Math.round(imageBuffers.topGainers.length / 1024)}KB + ${Math.round(imageBuffers.topLosers.length / 1024)}KB)`,
          severity: 'info',
        },
      });

      // Get gainers/losers for captions
      const { gainers, losers } = generateGainersLosers();

      // Post captions
      const summaryCaption = formatImageCaption(nepseDataForFormat);
      const gainersCaption = formatGainersCaption(marketData.tradingDate, gainers);
      const losersCaption = formatLosersCaption(marketData.tradingDate, losers);

      const postsToMake: Array<{ buffer: Buffer; caption: string; label: string }> = [
        { buffer: imageBuffers.marketSummary, caption: summaryCaption, label: 'Market Summary' },
        { buffer: imageBuffers.topGainers, caption: gainersCaption, label: 'Top Gainers' },
        { buffer: imageBuffers.topLosers, caption: losersCaption, label: 'Top Losers' },
      ];

      const results: Array<{ label: string; success: boolean; postId?: string; error?: string }> = [];

      for (let i = 0; i < postsToMake.length; i++) {
        const post = postsToMake[i];

        const fbPost = await db.facebookPost.create({
          data: {
            marketDataId: marketData.id,
            message: `[IMAGE] ${post.label}: ${post.caption.substring(0, 100)}...`,
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
            description: `Posting ${post.label} image (${Math.round(post.buffer.length / 1024)}KB) for ${marketData.tradingDate}...`,
            severity: 'info',
          },
        });

        const result = await postPhotoToFacebook(post.buffer, post.caption, pageAccessToken, pageId);

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
              description: `Successfully posted ${post.label} image. Facebook Post ID: ${result.postId}`,
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
              description: `Failed to post ${post.label} image: ${result.error}`,
              severity: 'error',
            },
          });
        }

        results.push({
          label: post.label,
          success: result.success,
          postId: result.postId,
          error: result.error,
        });

        // 10-second delay between posts to avoid rate limiting
        if (i < postsToMake.length - 1) {
          await delay(10000);
        }
      }

      const allSuccess = results.every((r) => r.success);
      return NextResponse.json({
        success: allSuccess,
        mode: 'image',
        marketData,
        posts: results,
        message: allSuccess
          ? `All 3 image posts published for ${marketData.tradingDate}`
          : `Some posts failed for ${marketData.tradingDate}`,
      });
    }

    // ---- TEXT MODE ----
    const message = formatMarketUpdate(nepseDataForFormat);

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
        description: `Attempting to post market update for ${marketData.tradingDate} to Facebook (text mode).`,
        severity: 'info',
      },
    });

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

    const updatedPost = await db.facebookPost.findUnique({
      where: { id: fbPost.id },
    });

    return NextResponse.json({
      success: result.success,
      mode: 'text',
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