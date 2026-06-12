// Facebook photo posting via Graph API v21.0
// Uploads images as photo posts with captions using multipart/form-data

interface PhotoPostResult {
  success: boolean;
  postId?: string;
  error?: string;
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
  // Check sandbox mode (empty/missing credentials)
  const isSandbox = !pageAccessToken || !pageId || pageAccessToken === '' || pageId === '';

  if (isSandbox) {
    // Simulate successful photo post in sandbox mode
    await delay(500);
    return {
      success: true,
      postId: `photo_mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };
  }

  // Build multipart/form-data manually (avoids encoding issues)
  const boundary = `----FormBoundary${Date.now()}${Math.random().toString(36).substring(2)}`;

  const captionPart = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${message}\r\n`,
  );

  const imagePart = [
    `--${boundary}\r\nContent-Disposition: form-data; name="source"; filename="nepse-${Date.now()}.png"\r\nContent-Type: image/png\r\n\r\n`,
  ].join('');

  const closing = `\r\n--${boundary}--\r\n`;

  const body = Buffer.concat([
    captionPart,
    Buffer.from(imagePart),
    imageBuffer,
    Buffer.from(closing),
  ]);

  // Retry logic
  const maxAttempts = 3;
  let lastError = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/photos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body,
          signal: AbortSignal.timeout(30000),
        },
      );

      const data = await response.json() as Record<string, unknown>;

      if (response.ok && data.id) {
        return {
          success: true,
          postId: data.id as string,
        };
      }

      const errorObj = data.error as Record<string, string> | undefined;
      lastError = errorObj?.message || `HTTP ${response.status}: Unknown error`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown error';
    }

    if (attempt < maxAttempts) {
      await delay(1000 * Math.pow(2, attempt - 1)); // Exponential backoff
    }
  }

  return {
    success: false,
    error: lastError,
  };
}
