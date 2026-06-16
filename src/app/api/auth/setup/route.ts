import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, createSession, hasAnyUser } from '@/lib/auth';

// Auto-create the User table if it doesn't exist (for Turso on first deploy)
async function ensureUserTable(): Promise<{ ok: boolean; error?: string }> {
  try {
    await db.user.count();
    return { ok: true };
  } catch (firstErr) {
    // Table likely doesn't exist — create it via raw SQL
    // Use separate statements (some adapters don't support multi-statement)
    try {
      await db.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "User" ("id" TEXT NOT NULL PRIMARY KEY, "email" TEXT NOT NULL, "passwordHash" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('CREATE TABLE failed:', msg);
      return { ok: false, error: `CREATE TABLE failed: ${msg}` };
    }

    try {
      await db.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('CREATE INDEX failed:', msg);
      // Non-fatal — continue
    }

    // Verify the table works now
    try {
      await db.user.count();
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: `Table created but Prisma can't query it: ${msg}` };
    }
  }
}

// POST /api/auth/setup — First-time user creation
export async function POST(request: NextRequest) {
  try {
    const tableResult = await ensureUserTable();
    if (!tableResult.ok) {
      return NextResponse.json(
        { error: `Database setup failed: ${tableResult.error}` },
        { status: 500 },
      );
    }

    // Only allow setup if no user exists yet
    const userExists = await hasAnyUser();
    if (userExists) {
      return NextResponse.json(
        { error: 'Setup already completed. An account already exists.' },
        { status: 403 },
      );
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 },
      );
    }

    if (typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 },
      );
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(password);
    await db.user.create({
      data: { email: email.trim().toLowerCase(), passwordHash },
    });

    const { token, setCookieHeader } = await createSession();

    return NextResponse.json(
      { success: true, message: 'Account created successfully.' },
      {
        status: 201,
        headers: { 'Set-Cookie': setCookieHeader },
      },
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Setup error:', errMsg, error);
    return NextResponse.json(
      { error: `Setup failed: ${errMsg}` },
      { status: 500 },
    );
  }
}

// GET /api/auth/setup — Check if setup is needed
export async function GET() {
  try {
    const userExists = await hasAnyUser();
    return NextResponse.json({ setupNeeded: !userExists });
  } catch {
    return NextResponse.json({ setupNeeded: true });
  }
}