import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';
import { isValidEmail, sanitizeString } from '@/lib/validation';

export async function POST(req: NextRequest) {
  try {
    const { email, name, password } = await req.json();

    if (!email || !name || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const sanitizedEmail = email.toLowerCase().trim();
    const sanitizedName = sanitizeString(name, 100);

    if (!isValidEmail(sanitizedEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    if (password.length > 128) {
      return NextResponse.json({ error: 'Password must be less than 128 characters' }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email: sanitizedEmail } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const hashedPassword = await hashPassword(password);
    const user = await db.user.create({
      data: { email: sanitizedEmail, name: sanitizedName, password: hashedPassword },
    });

    const token = generateToken({ userId: user.id, email: user.email });

    return NextResponse.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, telegramChatId: user.telegramChatId, telegramLinkedAt: user.telegramLinkedAt },
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}