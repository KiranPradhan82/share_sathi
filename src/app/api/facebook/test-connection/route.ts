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

    // Step 1: Verify the token is valid via debug_token
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

    // Check if token has expired
    if (tokenInfo.expires_at && tokenInfo.expires_at < Date.now() / 1000) {
      return NextResponse.json({
        success: false,
        error: 'Token has expired. Please generate a new one.',
      });
    }

    const tokenType = tokenInfo.type || 'unknown';
    const perms = tokenInfo.scopes ? tokenInfo.scopes.join(', ') : 'unknown';

    // Step 2: Verify the token can actually access the page
    // System User tokens don't have profile_id, so we verify by querying the page
    const pageRes = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}?fields=id,name&access_token=${encodeURIComponent(pageAccessToken)}`,
      { signal: AbortSignal.timeout(15000) },
    );

    const pageData = await pageRes.json();

    if (!pageRes.ok || pageData.error) {
      const fbErr = pageData.error?.message || `HTTP ${pageRes.status}`;
      return NextResponse.json({
        success: false,
        error: `Token cannot access page ${pageId}: ${fbErr}. Make sure you granted pages_manage_posts permission to this page.`,
      });
    }

    // Step 3: Check posting permission specifically
    const permRes = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}?fields=id&access_token=${encodeURIComponent(pageAccessToken)}`,
      { signal: AbortSignal.timeout(15000) },
    );

    // If we got here, token is valid and can access the page
    const expiresInfo = tokenInfo.expires_at
      ? new Date(tokenInfo.expires_at * 1000).toISOString()
      : 'never (long-lived or system token)';

    return NextResponse.json({
      success: true,
      pageName: pageData.name || `Page ${pageId}`,
      details: {
        valid: true,
        type: tokenType,
        pageId: pageData.id,
        pageName: pageData.name,
        permissions: perms,
        expiresAt: expiresInfo,
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