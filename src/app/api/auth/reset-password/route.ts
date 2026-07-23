import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, createSession } from '@/lib/auth';

// Ensure User table exists
async function ensureUserTable() {
  try {
    await db.user.count();
  } catch {
    try {
      await db.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "User" ("id" TEXT NOT NULL PRIMARY KEY, "email" TEXT NOT NULL, "passwordHash" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
      );
      await db.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`
      );
    } catch (e) {
      console.error('Auto-create User table failed:', e);
    }
  }
}

// POST /api/auth/reset-password
// Reset password for the single user account.
// Authenticated via AUTH_RESET_SECRET env var (sent as Bearer token).
// This is a single-user app, so there's only one account to reset.
export async function POST(request: NextRequest) {
  try {
    // Verify reset secret
    const resetSecret = process.env.AUTH_RESET_SECRET;
    if (!resetSecret) {
      return NextResponse.json(
        { error: 'AUTH_RESET_SECRET not configured on server.' },
        { status: 500 },
      );
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${resetSecret}`) {
      return NextResponse.json(
        { error: 'Invalid reset secret.' },
        { status: 401 },
      );
    }

    await ensureUserTable();

    const { newPassword } = await request.json();

    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json(
        { error: 'newPassword is required.' },
        { status: 400 },
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 },
      );
    }

    // Find the single user
    const user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json(
        { error: 'No user account found. Run setup first.' },
        { status: 404 },
      );
    }

    // Update password
    const passwordHash = await hashPassword(newPassword);
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Create a new session so they're logged in immediately
    const { setCookieHeader } = await createSession();

    return NextResponse.json(
      { success: true, message: `Password reset for ${user.email}. You are now logged in.` },
      {
        status: 200,
        headers: { 'Set-Cookie': setCookieHeader },
      },
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Password reset error:', errMsg, error);
    return NextResponse.json(
      { error: `Password reset failed: ${errMsg}` },
      { status: 500 },
    );
  }
}