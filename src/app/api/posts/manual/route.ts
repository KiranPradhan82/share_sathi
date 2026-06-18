import { NextRequest, NextResponse } from 'next/server';

// Vercel serverless function timeout — need enough for multiple FB API calls + delays
export const maxDuration = 300;
import { db } from '@/lib/db';
import { fetchNepseData } from '@/lib/nepse';
import { formatMarketUpdate, formatImageCaption, formatGainersCaption, formatLosersCaption, formatStockCardCaption, formatIpoCardCaption } from '@/lib/content-formatter';
import { postToFacebook } from '@/lib/facebook';
import { postPhotoToFacebook } from '@/lib/facebook-photo';
import { parseTopStocksFromRawData, parseStockDataFromRawData } from '@/lib/nepse';
import { requireAuth } from '@/lib/require-auth';

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
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  try {
    let date: string | undefined;
    let mode = 'image';
    let clientImages: Record<string, string> | null = null;
    let clientStockCards: Array<{ type: string; rank: number; symbol: string; name: string; image: string }> | null = null;

    try {
      const body = await request.json();
      date = body.date || undefined;
      mode = body.mode || 'image';
      clientImages = body.images || null;
      clientStockCards = body.stockCards || null;
    } catch {
      date = undefined;
    }

    // Step 1: Get market data
    let marketData = date
      ? await db.marketData.findUnique({ where: { tradingDate: date } })
      : await db.marketData.findFirst({ orderBy: { tradingDate: 'desc' } });

    if (!marketData) {
      const nepseData = await fetchNepseData(date);

      // Use upsert to handle race conditions (data created between findUnique and create)
      marketData = await db.marketData.upsert({
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

    // Step 2: Get Facebook credentials and validate token BEFORE posting
    const pageAccessToken = await getConfigValue('facebook_page_access_token');
    const pageId = await getConfigValue('facebook_page_id');

    if (!pageAccessToken || !pageId) {
      return NextResponse.json(
        { error: 'Facebook Page ID and Access Token are not configured. Go to Settings to add them.' },
        { status: 400 },
      );
    }

    // Pre-validate the token by calling the test connection
    const { testConnection } = await import('@/lib/facebook');
    const connResult = await testConnection(pageAccessToken, pageId);
    if (!connResult.success) {
      const errorMsg = (connResult.error || '').toLowerCase();
      let userMessage = connResult.error || 'Token validation failed.';
      if (errorMsg.includes('190') || errorMsg.includes('expired') || errorMsg.includes('session has expired')) {
        userMessage = `Your Facebook access token has EXPIRED. You need to generate a new NEVER-EXPIRING System User token:\n\n` +
          `1. Go to Meta for Developers → your app → App Roles → System Users\n` +
          `2. Use the "System User Token Generator" tool\n` +
          `3. Select your Page and generate a token with pages_manage_posts permission\n` +
          `4. The new token should show "Never" as expiry date\n` +
          `5. Paste it in Share Sathi Settings\n\n` +
          `Original error: ${connResult.error}`;
      } else if (errorMsg.includes('190') || errorMsg.includes('invalid') || errorMsg.includes('oauth')) {
        userMessage = `Your Facebook access token is INVALID. Please check the token in Settings.\n\nOriginal error: ${connResult.error}`;
      }
      return NextResponse.json(
        { error: userMessage },
        { status: 400 },
      );
    }

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
      const hasSummaryImages = clientImages?.marketSummary && clientImages?.topGainers && clientImages?.topLosers;
      const hasStockCards = clientStockCards && clientStockCards.length > 0;

      if (!hasSummaryImages && !hasStockCards) {
        return NextResponse.json(
          { error: 'No images provided. Generate images in the browser first.' },
          { status: 400 },
        );
      }

      // Convert summary image data URIs to buffers (if provided in this batch)
      let imageBuffers: Record<string, Buffer> | null = null;
      if (hasSummaryImages) {
        try {
          imageBuffers = {
            marketSummary: dataUriToBuffer(clientImages!.marketSummary),
            topGainers: dataUriToBuffer(clientImages!.topGainers),
            topLosers: dataUriToBuffer(clientImages!.topLosers),
          };
        } catch (convErr) {
          const errMsg = convErr instanceof Error ? convErr.message : 'Unknown conversion error';
          return NextResponse.json(
            { error: `Failed to decode base64 images: ${errMsg}` },
            { status: 400 },
          );
        }

        // Validate buffers — check for PNG header
        const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        for (const [key, buf] of Object.entries(imageBuffers)) {
          if (buf.length < 100) {
            return NextResponse.json(
              { error: `Invalid ${key} image (${buf.length} bytes) — too small, likely corrupted` },
              { status: 400 },
            );
          }
          const hasValidHeader = buf.length >= 8 && buf.slice(0, 8).equals(pngSignature);
          if (!hasValidHeader) {
            const firstBytes = buf.slice(0, 16).toString('hex');
            return NextResponse.json(
              { error: `Invalid ${key} image — not a valid PNG. First bytes: ${firstBytes}` },
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
      }

      // Get real gainers/losers from stored rawData
      const { gainers, losers } = parseTopStocksFromRawData(marketData.rawData);
      const fullStockData = parseStockDataFromRawData(marketData.rawData);

      const postsToMake: Array<{ buffer: Buffer; caption: string; label: string }> = [];

      // Add summary posts if we have them
      if (imageBuffers) {
        const summaryCaption = formatImageCaption(nepseDataForFormat);
        const gainersCaption = formatGainersCaption(marketData.tradingDate, gainers);
        const losersCaption = formatLosersCaption(marketData.tradingDate, losers);
        postsToMake.push(
          { buffer: imageBuffers.marketSummary, caption: summaryCaption, label: 'Market Summary' },
          { buffer: imageBuffers.topGainers, caption: gainersCaption, label: 'Top Gainers' },
          { buffer: imageBuffers.topLosers, caption: losersCaption, label: 'Top Losers' },
        );
      }

      // Add individual stock card posts if provided
      if (clientStockCards && clientStockCards.length > 0) {
        for (const card of clientStockCards) {
          const cardBuffer = dataUriToBuffer(card.image);
          // Validate PNG header
          if (cardBuffer.length >= 8 && !cardBuffer.slice(0, 8).equals(pngSignature)) {
            // Skip invalid stock card images
            continue;
          }

          // Find the full stock data for this card to generate a proper caption
          const allStocks = [
            ...fullStockData.gainers.map(s => ({ ...s, _type: 'gainer' as const })),
            ...fullStockData.losers.map(s => ({ ...s, _type: 'loser' as const })),
          ];
          const match = allStocks.find(s => s.symbol === card.symbol);
          const stockType = (card.type === 'gainer' ? 'gainer' : 'loser') as 'gainer' | 'loser';

          const caption = match
            ? formatStockCardCaption(match, stockType)
            : `${card.name} (${card.symbol}) ${stockType === 'gainer' ? 'Positive' : 'Negative'} Circuit Today\n\n#NEPSE #ShareSathi #NepalStockExchange #StockMarket #${card.symbol}`;

          postsToMake.push({
            buffer: cardBuffer,
            caption,
            label: `${stockType === 'gainer' ? 'Gainer' : 'Loser'}: ${card.symbol}`,
          });
        }
      }

      const results: Array<{
        label: string;
        success: boolean;
        postId?: string;
        error?: string;
        debug?: { imageBufferSize: number; captionLength: number; captionPreview: string };
      }> = [];

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
            description: `Posting ${post.label} image (${Math.round(post.buffer.length / 1024)}KB) for ${marketData.tradingDate} [${i + 1}/${postsToMake.length}]...`,
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
          debug: result.debug,
        });

        if (i < postsToMake.length - 1) {
          await delay(3000);
        }
      }

      const allSuccess = results.every((r) => r.success);
      const successCount = results.filter(r => r.success).length;
      return NextResponse.json({
        success: allSuccess,
        mode: 'image',
        marketData,
        posts: results,
        message: allSuccess
          ? `All ${results.length} image posts published for ${marketData.tradingDate}`
          : `${successCount}/${results.length} posts succeeded for ${marketData.tradingDate}`,
      });
    }

    // ---- SINGLE STOCK CARD MODE ----
    if (mode === 'stock_card' && clientImages && clientImages.stockCardImage) {
      const cardInfo = clientImages.cardInfo as { symbol: string; change: number; changePercent: number; closePrice: number; type: 'gainer' | 'loser' } | undefined;
      if (!cardInfo) {
        return NextResponse.json({ error: 'Missing cardInfo for stock card post' }, { status: 400 });
      }

      let imageBuffer: Buffer;
      try {
        imageBuffer = dataUriToBuffer(clientImages.stockCardImage);
      } catch (convErr) {
        return NextResponse.json({ error: `Failed to decode base64 image: ${convErr instanceof Error ? convErr.message : 'Unknown'}` }, { status: 400 });
      }

      const caption = formatStockCardCaption(cardInfo, cardInfo.type);

      const fbPost = await db.facebookPost.create({
        data: {
          marketDataId: marketData.id,
          message: `[STOCK CARD] ${cardInfo.symbol}: ${caption.substring(0, 100)}...`,
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
          description: `Posting stock card for ${cardInfo.symbol} (${Math.round(imageBuffer.length / 1024)}KB)...`,
          severity: 'info',
        },
      });

      const result = await postPhotoToFacebook(imageBuffer, caption, pageAccessToken, pageId);

      if (result.success) {
        await db.facebookPost.update({
          where: { id: fbPost.id },
          data: { status: 'success', facebookPostId: result.postId || null, postedTime: new Date() },
        });
        await db.systemEvent.create({
          data: {
            eventType: 'post', entityType: 'facebook_post', entityId: fbPost.id, facebookPostId: fbPost.id,
            description: `Successfully posted ${cardInfo.symbol} stock card. Facebook Post ID: ${result.postId}`,
            severity: 'success',
          },
        });
      } else {
        await db.facebookPost.update({
          where: { id: fbPost.id },
          data: { status: 'failed', attemptCount: 1, errorMessage: result.error || 'Unknown error' },
        });
        await db.systemEvent.create({
          data: {
            eventType: 'post', entityType: 'facebook_post', entityId: fbPost.id, facebookPostId: fbPost.id,
            description: `Failed to post ${cardInfo.symbol} stock card: ${result.error}`,
            severity: 'error',
          },
        });
      }

      return NextResponse.json({
        success: result.success,
        mode: 'stock_card',
        postId: result.postId,
        error: result.error,
      });
    }

    // ---- IPO CARD MODE ----
    if (mode === 'ipo_card' && clientImages && clientImages.ipoCardImage) {
      const ipoInfo = clientImages.ipoInfo as {
        companyName: string; companySymbol: string; ipoType: string; issueManager: string;
        issuedUnits: number; numberOfApplications: number; appliedUnits: number;
        totalAmount: number; openDate: string; closeDate: string;
        oversubscription: number | null; isOpen: boolean; openedToday: boolean;
      } | undefined;
      if (!ipoInfo) {
        return NextResponse.json({ error: 'Missing ipoInfo for IPO card post' }, { status: 400 });
      }

      let imageBuffer: Buffer;
      try {
        imageBuffer = dataUriToBuffer(clientImages.ipoCardImage);
      } catch (convErr) {
        return NextResponse.json({ error: `Failed to decode base64 image: ${convErr instanceof Error ? convErr.message : 'Unknown'}` }, { status: 400 });
      }

      const caption = formatIpoCardCaption(ipoInfo);

      const fbPost = await db.facebookPost.create({
        data: {
          marketDataId: marketData.id,
          message: `[IPO CARD] ${ipoInfo.companyName}: ${caption.substring(0, 100)}...`,
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
          description: `Posting IPO card for ${ipoInfo.companyName} (${Math.round(imageBuffer.length / 1024)}KB)...`,
          severity: 'info',
        },
      });

      const result = await postPhotoToFacebook(imageBuffer, caption, pageAccessToken, pageId);

      if (result.success) {
        await db.facebookPost.update({
          where: { id: fbPost.id },
          data: { status: 'success', facebookPostId: result.postId || null, postedTime: new Date() },
        });
        await db.systemEvent.create({
          data: {
            eventType: 'post', entityType: 'facebook_post', entityId: fbPost.id, facebookPostId: fbPost.id,
            description: `Successfully posted ${ipoInfo.companyName} IPO card. Facebook Post ID: ${result.postId}`,
            severity: 'success',
          },
        });
      } else {
        await db.facebookPost.update({
          where: { id: fbPost.id },
          data: { status: 'failed', attemptCount: 1, errorMessage: result.error || 'Unknown error' },
        });
        await db.systemEvent.create({
          data: {
            eventType: 'post', entityType: 'facebook_post', entityId: fbPost.id, facebookPostId: fbPost.id,
            description: `Failed to post ${ipoInfo.companyName} IPO card: ${result.error}`,
            severity: 'error',
          },
        });
      }

      return NextResponse.json({
        success: result.success,
        mode: 'ipo_card',
        postId: result.postId,
        error: result.error,
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