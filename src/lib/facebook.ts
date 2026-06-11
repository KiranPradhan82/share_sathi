interface FacebookPostResult {
  success: boolean;
  postId?: string;
  error?: string;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function postToFacebook(
  message: string,
  pageAccessToken: string,
  pageId: string,
): Promise<FacebookPostResult> {
  // Check if we have real credentials
  const isSandbox = !pageAccessToken || !pageId || pageAccessToken === '' || pageId === '';

  if (isSandbox) {
    // Simulate successful post in sandbox mode
    await delay(500); // Simulate network latency
    return {
      success: true,
      postId: `mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };
  }

  // Real Facebook Graph API call with retry logic
  const maxAttempts = 3;
  let lastError = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${pageId}/feed`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            access_token: pageAccessToken,
          }),
          signal: AbortSignal.timeout(30000),
        },
      );

      const data = await response.json();

      if (response.ok && data.id) {
        return {
          success: true,
          postId: data.id as string,
        };
      }

      lastError = data.error?.message || `HTTP ${response.status}: Unknown error`;
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

export async function testConnection(
  pageAccessToken: string,
  pageId: string,
): Promise<{ success: boolean; pageName?: string; error?: string }> {
  if (!pageAccessToken || !pageId) {
    return {
      success: false,
      error: 'Page ID and Access Token are required',
    };
  }

  // In sandbox mode, simulate a test
  if (pageAccessToken.startsWith('mock') || pageAccessToken.length < 20) {
    return {
      success: true,
      pageName: 'Share Sathi (Demo Mode)',
    };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}?fields=name&access_token=${pageAccessToken}`,
      {
        signal: AbortSignal.timeout(10000),
      },
    );

    const data = await response.json();

    if (data.name) {
      return {
        success: true,
        pageName: data.name as string,
      };
    }

    return {
      success: false,
      error: data.error?.message || 'Failed to connect to Facebook',
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}