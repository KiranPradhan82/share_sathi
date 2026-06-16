import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';

// GET /api/auth/check — Validate current session
export async function GET(request: NextRequest) {
  const token = request.cookies.get('sharesathi_session')?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const valid = await validateSession(token);
  if (!valid) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true });
}