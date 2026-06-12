import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/require-auth';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const { pageId, pageAccessToken, appId, appSecret } = body;

    if (!pageId || !pageAccessToken) {
      return NextResponse.json(
        { success: false, error: 'Page ID and Access Token are required' },
        { status: 400 },
      );
    }

    if (!appId || !appSecret) {
      return NextResponse.json(
        { success: false, error: 'App ID and App Secret are also required for token verification' },
        { status: 400 },
      );
    }

    // Use debug_token to verify the page access token
    // This does NOT require pages_read_engagement permission
    const appAccessToken = `${appId}|${appSecret}`;

    const debugRes = await fetch(
      `https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(pageAccessToken)}&access_token=${encodeURIComponent(appAccessToken)}`,
      { signal: AbortSignal.timeout(15000) },
    );

    const debugData = await debugRes.json();
    const tokenInfo = debugData.data;

    if (!tokenInfo || !tokenInfo.is_valid) {
      const reason = tokenInfo?.error?.message || 'Token is invalid or expired';
      return NextResponse.json({
        success: false,
        error: `Invalid token: ${reason}`,
      });
    }

    // Verify the token belongs to the correct page
    const tokenPageId = tokenInfo.profile_id;
    if (tokenPageId !== pageId) {
      return NextResponse.json({
        success: false,
        error: `Token mismatch: token belongs to page ${tokenPageId}, but you entered ${pageId}`,
      });
    }

    // Check if token has expired
    if (tokenInfo.expires_at && tokenInfo.expires_at < Date.now() / 1000) {
      return NextResponse.json({
        success: false,
        error: 'Token has expired. Please generate a new one from Graph API Explorer.',
      });
    }

    // List the permissions the token has
    const perms = tokenInfo.scopes ? tokenInfo.scopes.join(', ') : 'unknown';

    return NextResponse.json({
      success: true,
      pageName: `Page ${tokenPageId}`,
      details: {
        valid: true,
        type: tokenInfo.type,
        permissions: perms,
        expiresAt: tokenInfo.expires_at
          ? new Date(tokenInfo.expires_at * 1000).toISOString()
          : 'never',
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Test failed',
      },
      { status: 500 },
    );
  }
}