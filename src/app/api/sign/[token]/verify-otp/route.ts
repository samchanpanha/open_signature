import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyOtp } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const OTP_VERIFY_RATE_LIMIT = 5;
const OTP_VERIFY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { code } = await req.json();

    if (!code) {
      return NextResponse.json({ error: 'OTP code is required' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rateLimitKey = `otp-verify:${token}:${ip}`;
    const { allowed, retryAfterMs } = checkRateLimit(rateLimitKey, OTP_VERIFY_RATE_LIMIT, OTP_VERIFY_WINDOW_MS);

    if (!allowed) {
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Too many verification attempts. Try again in ${retryAfterSeconds} seconds.` },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      );
    }

    const signer = await db.signer.findUnique({
      where: { token },
    });

    if (!signer) {
      return NextResponse.json({ error: 'Invalid signing link' }, { status: 404 });
    }

    if (signer.signedAt) {
      return NextResponse.json({ error: 'Already signed' }, { status: 400 });
    }

    if (!signer.otpCode) {
      return NextResponse.json({ error: 'No OTP code requested. Please request a code first.' }, { status: 400 });
    }

    if (signer.otpRequestedAt && (Date.now() - signer.otpRequestedAt.getTime()) > OTP_EXPIRY_MS) {
      return NextResponse.json({ error: 'OTP code has expired. Please request a new code.' }, { status: 400 });
    }

    if (!verifyOtp(signer.otpCode, code)) {
      return NextResponse.json({ error: 'Invalid OTP code' }, { status: 400 });
    }

    await db.signer.update({
      where: { id: signer.id },
      data: { otpVerifiedAt: new Date() },
    });

    await db.auditLog.create({
      data: {
        action: 'OTP_VERIFIED',
        documentId: signer.documentId,
        signerId: signer.id,
        details: `OTP verified for signer ${signer.name} (${signer.email})`,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        userAgent: req.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json({ error: 'Failed to verify OTP' }, { status: 500 });
  }
}
