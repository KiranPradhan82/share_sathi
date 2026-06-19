// Facebook Reels posting via Graph API v21.0
// 3-phase upload: start → transfer bytes → finish

interface ReelPostResult {
  success: boolean;
  postId?: string;
  videoId?: string;
  error?: string;
  debug?: {
    videoFileSize: number;
    captionLength: number;
    phases: Array<{ phase: string; success: boolean; detail?: string }>;
  };
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function postReelToFacebook(
  videoBuffer: Buffer,
  caption: string,
  pageAccessToken: string,
  pageId: string,
): Promise<ReelPostResult> {
  const debug: ReelPostResult['debug'] = {
    videoFileSize: videoBuffer.length,
    captionLength: caption.length,
    phases: [],
  };

  if (!pageAccessToken || !pageId) {
    return { success: false, error: 'Facebook Page ID and Access Token are required.', debug };
  }

  if (!videoBuffer || videoBuffer.length < 1000) {
    return { success: false, error: `Invalid video buffer: ${videoBuffer?.length || 0} bytes`, debug };
  }

  // ---- Phase 1: Start upload session ----
  let uploadSessionId: string | null = null;
  let videoId: string | null = null;

  try {
    const startRes = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/video_reels?upload_phase=start&access_token=${encodeURIComponent(pageAccessToken)}`,
      { method: 'POST', signal: AbortSignal.timeout(30000) },
    );

    const startData = await startRes.json() as Record<string, unknown>;
    uploadSessionId = (startData.upload_session_id as string) || null;
    videoId = (startData.video_id as string) || null;

    if (!uploadSessionId) {
      const errMsg = (startData.error as Record<string, string>)?.message || `Start phase failed: HTTP ${startRes.status}`;
      debug.phases.push({ phase: 'start', success: false, detail: errMsg });
      return { success: false, error: errMsg, debug };
    }

    debug.phases.push({ phase: 'start', success: true, detail: `session=${uploadSessionId}` });
  } catch (err) {
    const msg = `Phase 1 (start) error: ${err instanceof Error ? err.message : 'Unknown'}`;
    debug.phases.push({ phase: 'start', success: false, detail: msg });
    return { success: false, error: msg, debug };
  }

  // ---- Phase 2: Transfer video bytes ----
  try {
    const transferRes = await fetch(
      `https://rupload.facebook.com/video-upload/v21.0/${uploadSessionId}`,
      {
        method: 'POST',
        headers: {
          'offset': '0',
          'file_size': videoBuffer.length.toString(),
          'Authorization': `OAuth ${pageAccessToken}`,
        },
        body: videoBuffer,
        signal: AbortSignal.timeout(120000), // 2 min timeout for video upload
      },
    );

    const transferData = await transferRes.json() as Record<string, unknown>;

    if (!transferRes.ok) {
      const errMsg = (transferData.error as Record<string, string>)?.message || `Transfer failed: HTTP ${transferRes.status}`;
      debug.phases.push({ phase: 'transfer', success: false, detail: errMsg });
      return { success: false, error: errMsg, debug };
    }

    debug.phases.push({ phase: 'transfer', success: true, detail: `${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB uploaded` });
  } catch (err) {
    const msg = `Phase 2 (transfer) error: ${err instanceof Error ? err.message : 'Unknown'}`;
    debug.phases.push({ phase: 'transfer', success: false, detail: msg });
    return { success: false, error: msg, debug };
  }

  // ---- Phase 3: Finish & publish ----
  try {
    const finishParams = new URLSearchParams({
      upload_phase: 'finish',
      upload_session_id: uploadSessionId!,
      video_id: videoId!,
      title: caption.substring(0, 100), // FB title limit
      description: caption,
      access_token: pageAccessToken,
    });

    const finishRes = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/video_reels?${finishParams.toString()}`,
      { method: 'POST', signal: AbortSignal.timeout(30000) },
    );

    const finishData = await finishRes.json() as Record<string, unknown>;

    if (finishRes.ok && (finishData.id || finishData.success)) {
      debug.phases.push({ phase: 'finish', success: true, detail: `post_id=${finishData.id}` });
      return {
        success: true,
        postId: (finishData.id as string) || videoId!,
        videoId: videoId!,
        debug,
      };
    }

    const errMsg = (finishData.error as Record<string, string>)?.message || `Finish failed: HTTP ${finishRes.status}`;
    debug.phases.push({ phase: 'finish', success: false, detail: errMsg });
    return { success: false, error: errMsg, debug };
  } catch (err) {
    const msg = `Phase 3 (finish) error: ${err instanceof Error ? err.message : 'Unknown'}`;
    debug.phases.push({ phase: 'finish', success: false, detail: msg });
    return { success: false, error: msg, debug };
  }
}