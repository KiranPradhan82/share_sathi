import { NextRequest, NextResponse } from 'next/server';

// Paths that don't require authentication
const PUBLIC_PATHS = ['/auth/setup', '/auth/login', '/auth/forgot-password', '/api/auth/setup', '/api/auth/login', '/api/auth/forgot-password', '/api/auth/verify-reset', '/api/auth/check', '/api/db-health'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/fonts/') ||
    pathname.includes('/logo') ||
    pathname.includes('.ico') ||
    pathname.includes('.woff') ||
    pathname.includes('.png') ||
    pathname.includes('.svg')
  ) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionToken = request.cookies.get('sharesathi_session')?.value;

  if (!sessionToken) {
    // No session — redirect to login (or setup if no user exists)
    // We can't easily check DB in middleware, so redirect to /auth/login
    // The login page itself checks if setup is needed and redirects
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  // Session cookie exists — let the request through
  // The API routes will do proper DB validation of the token
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};