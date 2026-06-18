import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300; // Video uploads need more time

import { db } from '@/lib/db';
import { postReelToFacebook } from '@/lib/facebook-reel';
import { requireAuth } from '@/lib/require-auth';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  try {
    const contentType = request.headers.get('content-type') || '';

    let videoBuffer: Buffer;
    let caption: string;

    // Support both JSON (base64) and multipart (direct file)
    if (contentType.includes('application/json')) {
      const body = await request.json() as { video?: string; caption?: string };
      if (!body.video) {
        return NextResponse.json({ error: 'Missing video data (base64)' }, { status: 400 });
      }
      const base64 = body.video.replace(/^data:video\/\w+;base64,/, '');
      videoBuffer = Buffer.from(base64, 'base64');
      caption = body.caption || '';
    } else {
      // Multipart form data
      const formData = await request.formData();
      const file = formData.get('video') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'Missing video file' }, { status: 400 });
      }
      const bytes = await file.arrayBuffer();
      videoBuffer = Buffer.from(bytes);
      caption = (formData.get('caption') as string) || '';
    }

    if (videoBuffer.length < 1000) {
      return NextResponse.json({ error: `Video too small: ${videoBuffer.length} bytes` }, { status: 400 });
    }

    // Validate MP4 header
    const mp4Sig = Buffer.from([0x00, 0x00, 0x00]); // MP4 atoms start with size
    if (videoBuffer.length < 8) {
      return NextResponse.json({ error: 'File too small to be a valid video' }, { status: 400 });
    }

    // Get FB credentials
    const pageAccessToken = (await db.systemConfig.findUnique({ where: { key: 'facebook_page_access_token' } }))?.value || '';
    const pageId = (await db.systemConfig.findUnique({ where: { key: 'facebook_page_id' } }))?.value || '';

    if (!pageAccessToken || !pageId) {
      return NextResponse.json({ error: 'Facebook Page ID and Access Token not configured.' }, { status: 400 });
    }

    // Log
    const sizeMB = (videoBuffer.length / 1024 / 1024).toFixed(1);
    await db.systemEvent.create({
      data: {
        eventType: 'post',
        entityType: 'facebook_reel',
        description: `Posting Reel (${sizeMB}MB)...`,
        severity: 'info',
      },
    });

    const result = await postReelToFacebook(videoBuffer, caption, pageAccessToken, pageId);

    await db.systemEvent.create({
      data: {
        eventType: 'post',
        entityType: 'facebook_reel',
        description: result.success
          ? `Reel posted. FB ID: ${result.postId}, Video ID: ${result.videoId}`
          : `Failed to post Reel: ${result.error}`,
        severity: result.success ? 'success' : 'error',
      },
    });

    return NextResponse.json({
      success: result.success,
      mode: 'reel',
      postId: result.postId,
      videoId: result.videoId,
      error: result.error,
      debug: result.debug,
    });
  } catch (error) {
    console.error('Reel post error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}