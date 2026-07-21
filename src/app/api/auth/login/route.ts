import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, generateToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

const LOGIN_RATE_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rateLimitKey = `login:${email}:${ip}`;
    const { allowed, retryAfterMs } = checkRateLimit(rateLimitKey, LOGIN_RATE_LIMIT, LOGIN_WINDOW_MS);

    if (!allowed) {
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Too many login attempts. Try again in ${retryAfterSeconds} seconds.` },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      );
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Check if user has pending memberships that need password setup
    const pendingMemberships = await db.organizationMember.findMany({
      where: { userId: user.id, inviteStatus: 'pending' },
    });

    if (pendingMemberships.length > 0) {
      return NextResponse.json({
        requiresPasswordSetup: true,
        message: 'Please set your password first',
        user: { id: user.id, email: user.email, name: user.name, telegramChatId: user.telegramChatId, telegramLinkedAt: user.telegramLinkedAt },
      }, { status: 200 });
    }

    // Update lastLoginAt for all active memberships
    await db.organizationMember.updateMany({
      where: { userId: user.id, inviteStatus: 'active' },
      data: { lastLoginAt: new Date() },
    });

    const token = generateToken({ userId: user.id, email: user.email });

    return NextResponse.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, telegramChatId: user.telegramChatId, telegramLinkedAt: user.telegramLinkedAt },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
