import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseStockDataFromRawData } from '@/lib/nepse';
import { formatImageCaption, formatGainersCaption, formatLosersCaption, formatStockCardCaption } from '@/lib/content-formatter';
import { postPhotoToFacebook } from '@/lib/facebook-photo';
import { requireAuth } from '@/lib/require-auth';

export const maxDuration = 60;

function dataUriToBuffer(dataUri: string): Buffer {
  const base64 = dataUri.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64, 'base64');
}

async function getConfigValue(key: string): Promise<string> {
  const config = await db.systemConfig.findUnique({ where: { key } });
  return config?.value || '';
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const { image, date, type, symbol, name, rank } = body;

    if (!image || !date || !type) {
      return NextResponse.json({ error: 'Missing required fields: image, date, type' }, { status: 400 });
    }

    // Validate image
    const buffer = dataUriToBuffer(image);
    const pngSig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    if (buffer.length < 100 || !buffer.slice(0, 8).equals(pngSig)) {
      return NextResponse.json({ error: `Invalid PNG image (${buffer.length} bytes)` }, { status: 400 });
    }

    // Get Facebook credentials
    const pageAccessToken = await getConfigValue('facebook_page_access_token');
    const pageId = await getConfigValue('facebook_page_id');
    if (!pageAccessToken || !pageId) {
      return NextResponse.json({ error: 'Facebook credentials not configured' }, { status: 400 });
    }

    // Get market data for caption
    const marketData = await db.marketData.findUnique({ where: { tradingDate: date } });
    if (!marketData) {
      return NextResponse.json({ error: `No market data for ${date}` }, { status: 404 });
    }

    // Build caption based on type
    let caption: string;
    const nepseData = {
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

    if (type === 'summary') {
      caption = formatImageCaption(nepseData);
    } else if (type === 'gainers') {
      const { gainers } = parseStockDataFromRawData(marketData.rawData);
      caption = formatGainersCaption(marketData.tradingDate, gainers);
    } else if (type === 'losers') {
      const { losers } = parseStockDataFromRawData(marketData.rawData);
      caption = formatLosersCaption(marketData.tradingDate, losers);
    } else if (type === 'stock-card') {
      const fullData = parseStockDataFromRawData(marketData.rawData);
      const allStocks = [
        ...fullData.gainers.map(s => ({ ...s, _type: 'gainer' as const })),
        ...fullData.losers.map(s => ({ ...s, _type: 'loser' as const })),
      ];
      const match = allStocks.find(s => s.symbol === symbol);
      const stockType = (type.includes('loser') ? 'loser' : 'gainer') as 'gainer' | 'loser';
      caption = match
        ? formatStockCardCaption(match, stockType)
        : `${name || symbol} ${stockType === 'gainer' ? 'Positive' : 'Negative'} Circuit Today\n\n#NEPSE #ShareSathi #NepalStockExchange #StockMarket #${symbol}`;
    } else {
      caption = `NEPSE Market Update - ${date}\n\n#NEPSE #ShareSathi`;
    }

    // Log and post
    const fbPost = await db.facebookPost.create({
      data: {
        marketDataId: marketData.id,
        message: `[SINGLE] ${type}: ${caption.substring(0, 80)}...`,
        status: 'posting',
        attemptCount: 1,
      },
    });

    const result = await postPhotoToFacebook(buffer, caption, pageAccessToken, pageId);

    if (result.success) {
      await db.facebookPost.update({
        where: { id: fbPost.id },
        data: { status: 'success', facebookPostId: result.postId || null, postedTime: new Date() },
      });
      await db.systemEvent.create({
        data: {
          eventType: 'post', entityType: 'facebook_post', entityId: fbPost.id, facebookPostId: fbPost.id,
          description: `Posted single image (${type}${symbol ? `: ${symbol}` : ''}). FB Post ID: ${result.postId}`,
          severity: 'success',
        },
      });
    } else {
      await db.facebookPost.update({
        where: { id: fbPost.id },
        data: { status: 'failed', attemptCount: 1, errorMessage: result.error || 'Unknown' },
      });
      await db.systemEvent.create({
        data: {
          eventType: 'post', entityType: 'facebook_post', entityId: fbPost.id, facebookPostId: fbPost.id,
          description: `Failed single image (${type}${symbol ? `: ${symbol}` : ''}): ${result.error}`,
          severity: 'error',
        },
      });
    }

    return NextResponse.json({
      success: result.success,
      postId: result.postId,
      error: result.error,
      type,
      label: type === 'stock-card' ? `${symbol} (#${rank})` : type,
    });
  } catch (error) {
    console.error('Single photo post error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}