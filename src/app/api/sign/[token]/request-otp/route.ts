import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;

    const signer = await db.signer.findUnique({
      where: { token },
      include: { document: true },
    });

    if (!signer) {
      return NextResponse.json({ error: 'Invalid signing link' }, { status: 404 });
    }

    if (signer.signedAt) {
      return NextResponse.json({ error: 'Already signed' }, { status: 400 });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));

    await db.signer.update({
      where: { id: signer.id },
      data: { otpCode: code },
    });

    if (process.env.SMTP_HOST) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@example.com',
        to: signer.email,
        subject: `Your verification code for ${signer.document.title}`,
        html: `
          <h2>Verification Code</h2>
          <p>Hello ${signer.name},</p>
          <p>Your verification code is: <strong>${code}</strong></p>
          <p>This code expires in 10 minutes.</p>
        `,
      });
    } else {
      console.log(`[OTP] Sending OTP to ${signer.email}: ${code}`);
    }

    await db.notification.create({
      data: {
        type: 'otp_request',
        title: 'OTP Code Sent',
        message: `A verification code has been sent to ${signer.email}`,
        userId: signer.document.ownerId,
        documentId: signer.documentId,
      },
    });

    await db.auditLog.create({
      data: {
        action: 'OTP_REQUESTED',
        documentId: signer.documentId,
        signerId: signer.id,
        details: `OTP code requested for signer ${signer.name} (${signer.email})`,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        userAgent: req.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Request OTP error:', error);
    return NextResponse.json({ error: 'Failed to request OTP' }, { status: 500 });
  }
}
