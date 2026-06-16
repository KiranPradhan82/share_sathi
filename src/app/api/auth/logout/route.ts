import { NextRequest, NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';

// POST /api/auth/logout
export async function POST() {
  const { clearCookieHeader } = await destroySession();
  return NextResponse.json(
    { success: true },
    {
      headers: { 'Set-Cookie': clearCookieHeader },
    },
  );
}