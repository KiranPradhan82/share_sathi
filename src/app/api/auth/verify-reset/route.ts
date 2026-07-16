import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, createSession } from '@/lib/auth';

// POST /api/auth/verify-reset
// Step 2: User enters email + OTP + new password → verify OTP, reset password, log in
export async function POST(request: NextRequest) {
  try {
    const { email, otp, newPassword } = await request.json();

    if (!email || !otp || !newPassword) {
      return NextResponse.json({ error: 'Email, verification code, and new password are required.' }, { status: 400 });
    }

    if (typeof otp !== 'string' || otp.length !== 6) {
      return NextResponse.json({ error: 'Invalid verification code.' }, { status: 400 });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    // Look up stored OTP
    const otpConfig = await db.systemConfig.findUnique({ where: { key: 'password_reset_otp' } });
    if (!otpConfig || !otpConfig.value) {
      return NextResponse.json({ error: 'No active verification code. Please request a new one.' }, { status: 400 });
    }

    // Parse stored value: email:otp:expiryTimestamp
    const parts = otpConfig.value.split(':');
    if (parts.length < 3) {
      return NextResponse.json({ error: 'Invalid reset state. Please request a new code.' }, { status: 400 });
    }

    const storedEmail = parts[0];
    const storedOtp = parts[1];
    const expiry = Number(parts[2]);

    // Verify email matches
    const normalizedEmail = email.trim().toLowerCase();
    if (storedEmail !== normalizedEmail) {
      return NextResponse.json({ error: 'Invalid verification code.' }, { status: 400 });
    }

    // Check expiry
    if (Date.now() > expiry) {
      // Clean up expired OTP
      await db.systemConfig.delete({ where: { key: 'password_reset_otp' } }).catch(() => {});
      return NextResponse.json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 });
    }

    // Verify OTP
    if (storedOtp !== otp) {
      return NextResponse.json({ error: 'Invalid verification code.' }, { status: 400 });
    }

    // Find and update user
    const user = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    const passwordHash = await hashPassword(newPassword);
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Delete used OTP
    await db.systemConfig.delete({ where: { key: 'password_reset_otp' } }).catch(() => {});

    // Create session
    const { setCookieHeader } = await createSession();

    return NextResponse.json(
      { success: true, message: 'Password reset successfully. You are now logged in.' },
      { status: 200, headers: { 'Set-Cookie': setCookieHeader } },
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Verify reset error:', errMsg, error);
    return NextResponse.json({ error: `Reset failed: ${errMsg}` }, { status: 500 });
  }
}