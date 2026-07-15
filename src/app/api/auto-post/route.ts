import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchNepseData, parseStockDataFromRawData } from '@/lib/nepse';
import { formatImageCaption, formatGainersCaption, formatLosersCaption, formatStockCardCaption } from '@/lib/content-formatter';
import { postPhotoToFacebook } from '@/lib/facebook-photo';
import { requireAuth } from '@/lib/require-auth';
import { verifyMarketData } from '@/lib/market-verifier';
import { generateAllImages, renderStockCard } from '@/lib/image-generator';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

async function getConfigValue(key: string): Promise<string> {
  const config = await db.systemConfig.findUnique({ where: { key } });
  return config?.value || '';
}

function getNepalToday(): string {
  const now = new Date();
  const nepalStr = now.toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' });
  const nepalDate = new Date(nepalStr);
  return nepalDate.toISOString().split('T')[0];
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Vercel cron requests send Authorization: Bearer <CRON_SECRET>
// Session cookies are not available for cron, so we validate via this header instead.
function isCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(request: NextRequest) {
  // Allow Vercel cron requests via CRON_SECRET; otherwise require session auth
  if (!isCronRequest(request)) {
    const auth = await requireAuth(request);
    if (!auth.authorized) return auth.response;
  }

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

    // Check if already posted today (with images)
    const todayNepal = getNepalToday();
    const todayData = await db.marketData.findUnique({ where: { tradingDate: todayNepal } });
    if (todayData) {
      const alreadyPosted = await db.facebookPost.findFirst({
        where: {
          marketDataId: todayData.id,
          status: 'success',
          message: { contains: '[AUTO-IMAGE]' },
        },
      });
      if (alreadyPosted) {
        return NextResponse.json({
          success: false,
          message: `Already auto-posted images for ${todayNepal}. Skipping duplicate.`,
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

    // =============================================
    // PHASE 1: Fetch YONEPSE data with date verification
    // =============================================
    const MAX_FETCH_ATTEMPTS = 6;
    const FETCH_RETRY_DELAY = 10 * 60 * 1000; // 10 minutes
    let nepseData: Awaited<ReturnType<typeof fetchNepseData>> | null = null;
    let fetchAttempts = 0;

    await db.systemEvent.create({
      data: {
        eventType: 'auto_post',
        entityType: 'market_data',
        description: `Auto-post pipeline started for ${todayNepal}. Phase 1: Fetching YONEPSE data...`,
        severity: 'info',
      },
    });

    for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
      fetchAttempts = attempt;
      try {
        const data = await fetchNepseData();

        if (data.tradingDate !== todayNepal) {
          await db.systemEvent.create({
            data: {
              eventType: 'auto_post',
              entityType: 'market_data',
              description: `Attempt ${attempt}/${MAX_FETCH_ATTEMPTS}: YONEPSE has data for ${data.tradingDate}, not today (${todayNepal}). Retrying in 10 min...`,
              severity: 'warning',
            },
          });
          if (attempt < MAX_FETCH_ATTEMPTS) await delay(FETCH_RETRY_DELAY);
          continue;
        }

        nepseData = data;
        break;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'Unknown error';
        await db.systemEvent.create({
          data: {
            eventType: 'auto_post',
            entityType: 'market_data',
            description: `Attempt ${attempt}/${MAX_FETCH_ATTEMPTS}: Fetch failed — ${errMsg}. Retrying in 10 min...`,
            severity: 'warning',
          },
        });
        if (attempt < MAX_FETCH_ATTEMPTS) await delay(FETCH_RETRY_DELAY);
      }
    }

    if (!nepseData) {
      return NextResponse.json({
        success: false,
        message: `Failed to fetch today's (${todayNepal}) data after ${MAX_FETCH_ATTEMPTS} attempts.`,
      });
    }

    // =============================================
    // PHASE 2: Verify against NEPSE official + Mero Lagani
    // =============================================
    await db.systemEvent.create({
      data: {
        eventType: 'auto_post',
        entityType: 'market_data',
        entityId: todayData?.id,
        description: `Phase 2: Verifying YONEPSE data (Index: ${nepseData.nepseIndex}) against official sources...`,
        severity: 'info',
      },
    });

    let verification = await verifyMarketData({
      nepseIndex: nepseData.nepseIndex,
      change: nepseData.change,
      changePercentage: nepseData.changePercentage,
      turnover: nepseData.turnover,
    });

    // If not verified, retry verification every 10 minutes up to 6 times
    const MAX_VERIFY_ATTEMPTS = 6;
    let verifyAttempts = 1;

    while (!verification.verified && verifyAttempts < MAX_VERIFY_ATTEMPTS) {
      verifyAttempts++;
      await db.systemEvent.create({
        data: {
          eventType: 'auto_post',
          entityType: 'market_data',
          description: `Verification attempt ${verifyAttempts}/${MAX_VERIFY_ATTEMPTS}: Data not yet matching official sources. Re-fetching YONEPSE and re-verifying in 10 min...\n${verification.matchDetails}`,
          severity: 'warning',
        },
      });

      await delay(FETCH_RETRY_DELAY);

      // Re-fetch from YONEPSE
      try {
        const freshData = await fetchNepseData();
        if (freshData.tradingDate === todayNepal) {
          nepseData = freshData;
        }
      } catch {
        // Keep existing data, just re-verify
      }

      verification = await verifyMarketData({
        nepseIndex: nepseData.nepseIndex,
        change: nepseData.change,
        changePercentage: nepseData.changePercentage,
        turnover: nepseData.turnover,
      });
    }

    // Log final verification result
    await db.systemEvent.create({
      data: {
        eventType: 'auto_post',
        entityType: 'market_data',
        description: `Verification result (after ${verifyAttempts} attempt(s)): verified=${verification.verified}\n${verification.matchDetails}`,
        severity: verification.verified ? 'success' : 'warning',
      },
    });

    // If still not verified after all retries, but both sources were unreachable,
    // proceed anyway (YONEPSE is generally reliable)
    if (!verification.verified) {
      if (verification.nepseOfficial === null && verification.meroLagani === null) {
        await db.systemEvent.create({
          data: {
            eventType: 'auto_post',
            entityType: 'market_data',
            description: 'Could not verify against any official source (both unreachable). Proceeding with YONEPSE data as it is generally reliable.',
            severity: 'warning',
          },
        });
      } else {
        return NextResponse.json({
          success: false,
          message: `YONEPSE data does not match official sources after ${verifyAttempts} verification attempts. Aborting auto-post.\n${verification.matchDetails}`,
        });
      }
    }

    // =============================================
    // PHASE 3: Upsert market data to DB
    // =============================================
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

    // =============================================
    // PHASE 4: Generate images server-side
    // =============================================
    await db.systemEvent.create({
      data: {
        eventType: 'auto_post',
        entityType: 'image',
        marketDataId: marketData.id,
        description: `Phase 4: Generating market images server-side...`,
        severity: 'info',
      },
    });

    const { gainers, losers } = parseStockDataFromRawData(nepseData.rawData);
    let images: Awaited<ReturnType<typeof generateAllImages>>;

    try {
      images = await generateAllImages(nepseData, gainers, losers);
    } catch (imgErr) {
      const errMsg = imgErr instanceof Error ? imgErr.message : 'Unknown image generation error';
      await db.systemEvent.create({
        data: {
          eventType: 'auto_post',
          entityType: 'image',
          marketDataId: marketData.id,
          description: `Image generation failed: ${errMsg}`,
          severity: 'error',
        },
      });
      return NextResponse.json({
        success: false,
        error: `Image generation failed: ${errMsg}`,
      }, { status: 500 });
    }

    await db.systemEvent.create({
      data: {
        eventType: 'auto_post',
        entityType: 'image',
        marketDataId: marketData.id,
        description: `Summary images generated (summary: ${Math.round(images.marketSummary.length / 1024)}KB, gainers: ${Math.round(images.topGainers.length / 1024)}KB, losers: ${Math.round(images.topLosers.length / 1024)}KB)`,
        severity: 'info',
      },
    });

    // Generate individual stock cards (top 10 gainers + top 10 losers = 20 cards)
    const topGainers = gainers.slice(0, 10);
    const topLosers = losers.slice(0, 10);
    const stockCards: Array<{ buffer: Buffer; caption: string; label: string; type: 'gainer' | 'loser'; symbol: string }> = [];

    await db.systemEvent.create({
      data: {
        eventType: 'auto_post',
        entityType: 'image',
        marketDataId: marketData.id,
        description: `Generating ${topGainers.length} gainer cards + ${topLosers.length} loser cards...`,
        severity: 'info',
      },
    });

    for (let i = 0; i < topGainers.length; i++) {
      const g = topGainers[i];
      try {
        const buffer = await renderStockCard(g, nepseData.tradingDate, 'gainer', i + 1);
        const caption = formatStockCardCaption({
          symbol: g.symbol,
          change: g.change,
          changePercent: g.changePercent,
          closePrice: g.closePrice,
        }, 'gainer');
        stockCards.push({ buffer, caption, label: `Gainer #${i + 1}: ${g.symbol}`, type: 'gainer', symbol: g.symbol });
      } catch (cardErr) {
        const errMsg = cardErr instanceof Error ? cardErr.message : 'Unknown error';
        await db.systemEvent.create({
          data: {
            eventType: 'auto_post',
            entityType: 'image',
            marketDataId: marketData.id,
            description: `Failed to generate gainer card #${i + 1} (${g.symbol}): ${errMsg}`,
            severity: 'warning',
          },
        });
      }
    }

    for (let i = 0; i < topLosers.length; i++) {
      const l = topLosers[i];
      try {
        const buffer = await renderStockCard(l, nepseData.tradingDate, 'loser', i + 1);
        const caption = formatStockCardCaption({
          symbol: l.symbol,
          change: l.change,
          changePercent: l.changePercent,
          closePrice: l.closePrice,
        }, 'loser');
        stockCards.push({ buffer, caption, label: `Loser #${i + 1}: ${l.symbol}`, type: 'loser', symbol: l.symbol });
      } catch (cardErr) {
        const errMsg = cardErr instanceof Error ? cardErr.message : 'Unknown error';
        await db.systemEvent.create({
          data: {
            eventType: 'auto_post',
            entityType: 'image',
            marketDataId: marketData.id,
            description: `Failed to generate loser card #${i + 1} (${l.symbol}): ${errMsg}`,
            severity: 'warning',
          },
        });
      }
    }

    await db.systemEvent.create({
      data: {
        eventType: 'auto_post',
        entityType: 'image',
        marketDataId: marketData.id,
        description: `Stock cards generated: ${stockCards.length}/${topGainers.length + topLosers.length} successful`,
        severity: stockCards.length > 0 ? 'success' : 'warning',
      },
    });

    // =============================================
    // PHASE 4.5: Pre-post verification
    // Re-verify data is still the latest right before posting
    // (data could have changed during image generation)
    // =============================================
    await db.systemEvent.create({
      data: {
        eventType: 'auto_post',
        entityType: 'market_data',
        marketDataId: marketData.id,
        description: `Phase 4.5: Pre-post verification — re-checking against NEPSE official and MeroLagani before posting...`,
        severity: 'info',
      },
    });

    const prePostVerification = await verifyMarketData({
      nepseIndex: nepseData.nepseIndex,
      change: nepseData.change,
      changePercentage: nepseData.changePercentage,
      turnover: nepseData.turnover,
    });

    if (prePostVerification.verified) {
      await db.systemEvent.create({
        data: {
          eventType: 'auto_post',
          entityType: 'market_data',
          marketDataId: marketData.id,
          description: `Pre-post verification PASSED. Data is still current.\n${prePostVerification.matchDetails}`,
          severity: 'success',
        },
      });
    } else if (prePostVerification.nepseOfficial === null && prePostVerification.meroLagani === null) {
      // Both sources unreachable — proceed (same logic as Phase 2)
      await db.systemEvent.create({
        data: {
          eventType: 'auto_post',
          entityType: 'market_data',
          marketDataId: marketData.id,
          description: `Pre-post verification: both official sources unreachable. Proceeding with YONEPSE data (same as Phase 2 fallback).`,
          severity: 'warning',
        },
      });
    } else {
      // Data mismatch detected — abort posting
      await db.systemEvent.create({
        data: {
          eventType: 'auto_post',
          entityType: 'market_data',
          marketDataId: marketData.id,
          description: `Pre-post verification FAILED. Data may have changed since Phase 2. Aborting post to avoid stale data.\n${prePostVerification.matchDetails}`,
          severity: 'error',
        },
      });
      return NextResponse.json({
        success: false,
        message: `Pre-post verification failed — data may have changed since initial verification. Aborting post.\n${prePostVerification.matchDetails}`,
      });
    }

    // =============================================
    // PHASE 5: Post all images to Facebook one by one
    // (3 summary images + individual stock cards)
    // =============================================
    const totalImages = 3 + stockCards.length;
    await db.systemEvent.create({
      data: {
        eventType: 'auto_post',
        entityType: 'facebook_post',
        marketDataId: marketData.id,
        description: `Phase 5: Posting ${totalImages} images to Facebook (3 summary + ${stockCards.length} stock cards)...`,
        severity: 'info',
      },
    });

    // Build complete posts array: 3 summary images first, then individual stock cards
    const postsToMake: Array<{ buffer: Buffer; caption: string; label: string }> = [
      {
        buffer: images.marketSummary,
        caption: formatImageCaption(nepseData),
        label: 'Market Summary',
      },
      {
        buffer: images.topGainers,
        caption: formatGainersCaption(marketData.tradingDate, gainers.slice(0, 10).map(g => ({
          symbol: g.symbol,
          change: g.change,
          changePercent: g.changePercent,
        }))),
        label: 'Top Gainers',
      },
      {
        buffer: images.topLosers,
        caption: formatLosersCaption(marketData.tradingDate, losers.slice(0, 10).map(l => ({
          symbol: l.symbol,
          change: l.change,
          changePercent: l.changePercent,
        }))),
        label: 'Top Losers',
      },
      // Individual stock cards (10 gainers + 10 losers)
      ...stockCards.map(card => ({
        buffer: card.buffer,
        caption: card.caption,
        label: card.label,
      })),
    ];

    const results: Array<{ label: string; success: boolean; postId?: string; error?: string }> = [];

    for (const post of postsToMake) {
      const fbPost = await db.facebookPost.create({
        data: {
          marketDataId: marketData.id,
          message: `[AUTO-IMAGE] ${post.label}: ${post.caption.substring(0, 100)}...`,
          status: 'posting',
          attemptCount: 1,
        },
      });

      // 3-second delay between posts to avoid rate limiting
      if (results.length > 0) await delay(3000);

      await db.systemEvent.create({
        data: {
          eventType: 'auto_post',
          entityType: 'facebook_post',
          entityId: fbPost.id,
          facebookPostId: fbPost.id,
          marketDataId: marketData.id,
          description: `Posting ${post.label} (${Math.round(post.buffer.length / 1024)}KB) [${results.length + 1}/${postsToMake.length}]...`,
          severity: 'info',
        },
      });

      const result = await postPhotoToFacebook(post.buffer, post.caption, pageAccessToken, pageId);

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
            description: `Successfully posted ${post.label}. FB ID: ${result.postId}`,
            severity: 'success',
          },
        });
        results.push({ label: post.label, success: true, postId: result.postId });
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
            description: `Failed to post ${post.label}: ${result.error}`,
            severity: 'error',
          },
        });
        results.push({ label: post.label, success: false, error: result.error });
      }
    }

    const successCount = results.filter(r => r.success).length;

    await db.systemEvent.create({
      data: {
        eventType: 'auto_post',
        entityType: 'system',
        marketDataId: marketData.id,
        description: `Auto-post pipeline completed for ${marketData.tradingDate}. Posted ${successCount}/${totalImages} images (${successCount > 0 ? '3 summary' : '0 summary'} + ${Math.max(0, successCount - 3)} stock cards). Fetch: ${fetchAttempts} attempts, Verify: ${verifyAttempts} attempts.`,
        severity: successCount === totalImages ? 'success' : (successCount > 0 ? 'warning' : 'error'),
      },
    });

    return NextResponse.json({
      success: successCount > 0,
      message: `Auto-posted ${successCount}/${totalImages} images for ${marketData.tradingDate} (3 summary + ${stockCards.length} stock cards, fetch: ${fetchAttempts} attempts, verify: ${verifyAttempts} attempts)`,
      results,
      fetchAttempts,
      verifyAttempts,
      verified: verification.verified,
      totalImages,
      summaryImages: 3,
      stockCardImages: stockCards.length,
    });
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
    purpose: 'NEPSE auto-post: fetch at 3:15 PM NPT, verify against official sources, generate images, post to Facebook',
    timezone: 'Asia/Kathmandu',
    schedule: '3:15 PM NPT (Sun-Thu)',
    retryPolicy: 'Fetch: 6 attempts x 10 min | Verify: 6 attempts x 10 min',
    pipeline: 'YONEPSE → Verify → Generate 3 summary + 20 stock card images → Pre-post Re-verify → Post all 23 images to Facebook one-by-one',
  });
}