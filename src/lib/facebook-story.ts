// Facebook Story posting via Graph API v21.0
// POST /{page-id}/stories with image source

interface StoryPostResult {
  success: boolean;
  postId?: string;
  error?: string;
  debug?: {
    imageBufferSize: number;
    captionLength: number;
    captionPreview: string;
  };
}

export async function postStoryToFacebook(
  imageBuffer: Buffer,
  message: string,
  pageAccessToken: string,
  pageId: string,
): Promise<StoryPostResult> {
  const debug = {
    imageBufferSize: imageBuffer.length,
    captionLength: message.length,
    captionPreview: message.substring(0, 80) + (message.length > 80 ? '...' : ''),
  };

  if (!pageAccessToken || !pageId) {
    return { success: false, error: 'Facebook Page ID and Access Token are required.', debug };
  }

  if (!imageBuffer || imageBuffer.length < 100) {
    return { success: false, error: `Invalid image buffer: ${imageBuffer?.length || 0} bytes`, debug };
  }

  const maxAttempts = 3;
  let lastError = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const formData = new FormData();
      formData.append('source', new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' }), `story-${Date.now()}.png`);
      // Stories caption is set via the `message` field
      if (message) {
        formData.append('message', message);
      }

      const response = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/stories?access_token=${encodeURIComponent(pageAccessToken)}`,
        {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(30000),
        },
      );

      const responseText = await response.text();

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(responseText) as Record<string, unknown>;
      } catch {
        return { success: false, error: `Non-JSON response (HTTP ${response.status}): ${responseText.substring(0, 300)}`, debug };
      }

      if (response.ok && data.id) {
        return { success: true, postId: data.id as string, debug };
      }

      const errorObj = data.error as Record<string, string> | undefined;
      const fbErrorCode = errorObj?.code || '';
      const fbErrorMsg = errorObj?.message || `HTTP ${response.status}: ${responseText.substring(0, 200)}`;

      lastError = `[${fbErrorCode}] ${fbErrorMsg}`;

      // Don't retry on auth/permission errors
      if (['190', '200', '102', '10'].includes(fbErrorCode)) break;
    } catch (err) {
      lastError = `Fetch error (attempt ${attempt}): ${err instanceof Error ? err.message : 'Unknown'}`;
    }

    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }

  return { success: false, error: lastError, debug };
}