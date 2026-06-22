import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

import { db } from '@/lib/db';
import { formatIpoCardCaption } from '@/lib/content-formatter';
import { postStoryToFacebook } from '@/lib/facebook-story';
import { requireAuth } from '@/lib/require-auth';

function dataUriToBuffer(dataUri: string): Buffer {
  const base64 = dataUri.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64, 'base64');
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const { image, ipoData, message } = body as {
      image?: string;
      ipoData?: Record<string, unknown>;
      message?: string;
    };

    if (!image) {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 });
    }

    // Decode image
    let imageBuffer: Buffer;
    try {
      imageBuffer = dataUriToBuffer(image);
    } catch {
      return NextResponse.json({ error: 'Failed to decode base64 image' }, { status: 400 });
    }

    // Validate PNG
    const pngSig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    if (imageBuffer.length < 100 || !imageBuffer.slice(0, 8).equals(pngSig)) {
      return NextResponse.json({ error: 'Invalid PNG image' }, { status: 400 });
    }

    // Get FB credentials
    const pageAccessToken = (await db.systemConfig.findUnique({ where: { key: 'facebook_page_access_token' } }))?.value || '';
    const pageId = (await db.systemConfig.findUnique({ where: { key: 'facebook_page_id' } }))?.value || '';

    if (!pageAccessToken || !pageId) {
      return NextResponse.json({ error: 'Facebook Page ID and Access Token not configured.' }, { status: 400 });
    }

    // Determine caption: use provided message for market stories, or generate IPO caption
    let caption: string;
    let logLabel: string;

    if (ipoData) {
      // IPO story path
      const closeDate = (ipoData.closeDate as string) || '';
      let isLastDay = (ipoData.isLastDay as boolean) || false;
      if (!isLastDay && closeDate) {
        try {
          const now = new Date();
          const nepalDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kathmandu' });
          isLastDay = closeDate === nepalDateStr;
        } catch { /* ignore */ }
      }

      caption = formatIpoCardCaption({
        companyName: (ipoData.companyName as string) || '',
        companySymbol: (ipoData.companySymbol as string) || '',
        ipoType: (ipoData.ipoType as string) || '',
        issueManager: (ipoData.issueManager as string) || '',
        issuedUnits: (ipoData.issuedUnits as number) || 0,
        numberOfApplications: (ipoData.numberOfApplications as number) || 0,
        appliedUnits: (ipoData.appliedUnits as number) || 0,
        totalAmount: (ipoData.totalAmount as number) || 0,
        openDate: (ipoData.openDate as string) || '',
        closeDate,
        oversubscription: ipoData.oversubscription as number | null,
        isOpen: (ipoData.isOpen as boolean) ?? false,
        openedToday: (ipoData.openedToday as boolean) ?? false,
        isLastDay,
      });
      logLabel = (ipoData.companySymbol as string) || 'IPO';
    } else {
      // Market story path — use the provided message
      caption = message || 'Share Sathi Market Update\n\n#NEPSE #ShareSathi #NepalStockMarket';
      logLabel = message?.substring(0, 40) || 'Market Update';
    }

    // Log
    await db.systemEvent.create({
      data: {
        eventType: 'post',
        entityType: 'facebook_story',
        description: `Posting Story for ${logLabel} (${Math.round(imageBuffer.length / 1024)}KB)...`,
        severity: 'info',
      },
    });

    const result = await postStoryToFacebook(imageBuffer, caption, pageAccessToken, pageId);

    await db.systemEvent.create({
      data: {
        eventType: 'post',
        entityType: 'facebook_story',
        description: result.success
          ? `Story posted for ${logLabel}. FB ID: ${result.postId}`
          : `Failed to post Story for ${logLabel}: ${result.error}`,
        severity: result.success ? 'success' : 'error',
      },
    });

    return NextResponse.json({
      success: result.success,
      mode: 'story',
      postId: result.postId,
      error: result.error,
      debug: result.debug,
    });
  } catch (error) {
    console.error('Story post error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}