// Facebook photo posting via Graph API v21.0
// Uses native FormData API (not manual multipart construction)
// This avoids "Offset is outside the bounds of the DataView" errors
// that occur with manual Buffer.concat multipart bodies in Vercel serverless.

interface PhotoPostResult {
  success: boolean;
  postId?: string;
  error?: string;
  debug?: {
    imageBufferSize: number;
    captionLength: number;
    captionPreview: string;
  };
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function postPhotoToFacebook(
  imageBuffer: Buffer,
  message: string,
  pageAccessToken: string,
  pageId: string,
): Promise<PhotoPostResult> {
  const debug = {
    imageBufferSize: imageBuffer.length,
    captionLength: message.length,
    captionPreview: message.substring(0, 80) + (message.length > 80 ? '...' : ''),
  };

  // Check sandbox mode (empty/missing credentials)
  const isSandbox = !pageAccessToken || !pageId || pageAccessToken === '' || pageId === '';

  if (isSandbox) {
    await delay(500);
    return {
      success: true,
      postId: `photo_mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      debug,
    };
  }

  // Validate image buffer before attempting upload
  if (!imageBuffer || imageBuffer.length < 100) {
    return {
      success: false,
      error: `Invalid image buffer: ${imageBuffer ? imageBuffer.length : 0} bytes (minimum 100)`,
      debug,
    };
  }

  // Check PNG signature
  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const hasValidPngHeader = imageBuffer.length >= 8 && imageBuffer.slice(0, 8).equals(pngSignature);
  if (!hasValidPngHeader) {
    return {
      success: false,
      error: `Image buffer does not have a valid PNG header. First 16 bytes (hex): ${imageBuffer.slice(0, 16).toString('hex')}`,
      debug,
    };
  }

  // Retry logic
  const maxAttempts = 3;
  let lastError = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Use native FormData API — this properly handles binary data
      // and avoids DataView/ArrayBuffer issues in serverless runtimes
      const formData = new FormData();
      formData.append('caption', message);
      formData.append('source', new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' }), `nepse-${Date.now()}.png`);

      const response = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/photos?access_token=${encodeURIComponent(pageAccessToken)}`,
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
        return {
          success: false,
          error: `Facebook returned non-JSON response (HTTP ${response.status}): ${responseText.substring(0, 300)}`,
          debug,
        };
      }

      if (response.ok && data.id) {
        return {
          success: true,
          postId: data.id as string,
          debug,
        };
      }

      const errorObj = data.error as Record<string, string> | undefined;
      const fbErrorCode = errorObj?.code || '';
      const fbErrorMsg = errorObj?.message || `HTTP ${response.status}: ${responseText.substring(0, 200)}`;
      const fbErrorType = errorObj?.type || '';

      lastError = `[${fbErrorCode}] ${fbErrorType ? `${fbErrorType}: ` : ''}${fbErrorMsg}`;

      // Don't retry on auth/permission errors
      if (['190', '200', '102', '10'].includes(fbErrorCode)) {
        break;
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      lastError = `Fetch/Network error (attempt ${attempt}): ${errMsg}`;
    }

    if (attempt < maxAttempts) {
      await delay(1000 * Math.pow(2, attempt - 1));
    }
  }

  return {
    success: false,
    error: lastError,
    debug,
  };
}