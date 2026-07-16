import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomBytes } from 'crypto';
import nodemailer from 'nodemailer';

// POST /api/auth/forgot-password
// Step 1: User enters email → generate 6-digit OTP, store in DB, send via Gmail
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    // Always return success to prevent email enumeration
    // But only send the email if the user exists
    if (user) {
      const otp = String(Number(randomBytes(3).toString('hex', 0, 6))).padStart(6, '0');

      // Store OTP in systemConfig (expires in 10 minutes)
      await db.systemConfig.upsert({
        where: { key: 'password_reset_otp' },
        update: {
          value: `${user.email}:${otp}:${Date.now() + 10 * 60 * 1000}`,
        },
        create: {
          key: 'password_reset_otp',
          value: `${user.email}:${otp}:${Date.now() + 10 * 60 * 1000}`,
        },
      });

      // Send OTP via Gmail (if configured)
      const gmailEmail = process.env.GMAIL_EMAIL;
      const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

      if (gmailEmail && gmailAppPassword) {
        try {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: gmailEmail, pass: gmailAppPassword },
          });

          await transporter.sendMail({
            from: gmailEmail,
            to: user.email,
            subject: 'Share Sathi - Password Reset Code',
            html: `
              <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                <h2 style="color: #1E3A5F; margin-bottom: 8px;">Password Reset</h2>
                <p style="color: #475569; margin-bottom: 24px;">Your verification code to reset your Share Sathi password is:</p>
                <div style="background: #F1F5F9; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                  <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1E3A5F;">${otp}</span>
                </div>
                <p style="color: #94A3B8; font-size: 14px;">This code expires in 10 minutes. If you did not request this, ignore this email.</p>
              </div>
            `,
          });
        } catch (emailErr) {
          console.error('Failed to send reset email:', emailErr);
          return NextResponse.json(
            { error: 'Failed to send verification email. Check your Gmail App Password settings.' },
            { status: 500 },
          );
        }
      } else {
        // No Gmail configured — show OTP directly (dev/fallback mode)
        console.log(`[DEV] Password reset OTP for ${user.email}: ${otp}`);
        return NextResponse.json({
          success: true,
          message: 'Verification code generated.',
          devMode: true,
          otp,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with that email, a verification code has been sent.',
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Forgot password error:', errMsg, error);
    return NextResponse.json({ error: `Request failed: ${errMsg}` }, { status: 500 });
  }
}