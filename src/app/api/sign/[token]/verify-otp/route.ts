import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { code } = await req.json();

    if (!code) {
      return NextResponse.json({ error: 'OTP code is required' }, { status: 400 });
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

    if (signer.otpCode !== code) {
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
