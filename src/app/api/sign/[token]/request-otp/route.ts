import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import nodemailer from 'nodemailer';
import { generateOtpCode, hashOtp } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { isSmsConfigured, sendSmsOtp } from '@/lib/sms';
import { sendOtpViaTelegram, TelegramError } from '@/lib/telegram';

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const OTP_REQUEST_RATE_LIMIT = 3;
const OTP_REQUEST_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = await req.json().catch(() => ({}));
    const method = body.method === 'sms' ? 'sms' : body.method === 'telegram' ? 'telegram' : 'email';
    const phone = body.phone;

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

    if (method === 'sms' && !isSmsConfigured()) {
      return NextResponse.json({ error: 'SMS verification is not available' }, { status: 400 });
    }

    if (method === 'sms' && !phone) {
      return NextResponse.json({ error: 'Phone number is required for SMS verification' }, { status: 400 });
    }

    if (method === 'telegram') {
      // Find the signer's user account by email and check for linked Telegram
      const user = await db.user.findFirst({ where: { email: signer.email } });
      if (!user?.telegramChatId) {
        return NextResponse.json(
          { error: 'Telegram account not linked. Please link your Telegram account first or use email/SMS.' },
          { status: 400 }
        );
      }
    }

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rateLimitKey = `otp-request:${token}:${ip}`;
    const { allowed, retryAfterMs } = checkRateLimit(rateLimitKey, OTP_REQUEST_RATE_LIMIT, OTP_REQUEST_WINDOW_MS);

    if (!allowed) {
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Too many OTP requests. Try again in ${retryAfterSeconds} seconds.` },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      );
    }

    const code = generateOtpCode();
    const hashedCode = hashOtp(code);

    await db.signer.update({
      where: { id: signer.id },
      data: {
        otpCode: hashedCode,
        otpRequestedAt: new Date(),
        otpMethod: method,
        ...(method === 'sms' && phone ? { phone } : {}),
      },
    });

    let sent = false;

    if (method === 'telegram') {
      // Send OTP via Telegram bot
      const user = await db.user.findFirst({ where: { email: signer.email } });
      if (user?.telegramChatId) {
        try {
          await sendOtpViaTelegram(user.telegramChatId, code, signer.document.title);
          sent = true;
        } catch (err) {
          const e = err as TelegramError;
          console.error('[OTP] Telegram send failed:', e.message);
          return NextResponse.json({ error: 'Failed to send OTP via Telegram. Please try email or SMS.' }, { status: 500 });
        }
        // Log the message
        await db.telegramMessageLog.create({
          data: {
            userId: user.id,
            chatId: user.telegramChatId,
            messageType: 'otp',
            content: `OTP sent for document: ${signer.document.title}`,
            status: 'sent',
          },
        });
      }
    } else if (method === 'sms' && phone) {
      sent = await sendSmsOtp(phone, code);
      if (!sent) {
        return NextResponse.json({ error: 'Failed to send SMS. Please try email instead.' }, { status: 500 });
      }
    } else {
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
        sent = true;
      } else {
        console.log(`[OTP] Sending OTP to ${signer.email} (test mode - email not configured)`);
        sent = true;
      }
    }

    await db.notification.create({
      data: {
        type: 'otp_request',
        title: 'OTP Code Sent',
        message: `A verification code has been sent via ${method} to ${method === 'sms' ? phone : method === 'telegram' ? 'Telegram' : signer.email}`,
        userId: signer.document.ownerId,
        documentId: signer.documentId,
      },
    });

    await db.auditLog.create({
      data: {
        action: 'OTP_REQUESTED',
        documentId: signer.documentId,
        signerId: signer.id,
        details: `OTP code requested via ${method} for signer ${signer.name} (${signer.email})`,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        userAgent: req.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ success: true, method });
  } catch (error) {
    console.error('Request OTP error:', error);
    return NextResponse.json({ error: 'Failed to request OTP' }, { status: 500 });
  }
}
