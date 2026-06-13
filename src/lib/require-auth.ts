// Reusable session validation for API routes
// Call at the top of any protected API route handler

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';

export async function requireAuth(request: NextRequest): Promise<{ authorized: true } | { authorized: false; response: NextResponse }> {
  const token = request.cookies.get('sharesathi_session')?.value;

  if (!token) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }),
    };
  }

  const valid = await validateSession(token);
  if (!valid) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Session expired. Please log in again.' },
        {
          status: 401,
          headers: { 'Set-Cookie': 'sharesathi_session=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/' },
        },
      ),
    };
  }

  return { authorized: true };
}