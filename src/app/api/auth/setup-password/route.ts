import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, verifyToken } from '@/lib/auth';

// Setup password for invited sub-member (first login)
export async function POST(req: NextRequest) {
  try {
    const { email, password, token } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find the user
    const user = await db.user.findFirst({ where: { email: normalizedEmail } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has any pending org memberships
    const pendingMember = await db.organizationMember.findFirst({
      where: { userId: user.id, inviteStatus: 'pending' },
    });

    if (!pendingMember) {
      return NextResponse.json({ error: 'No pending invitation found for this user' }, { status: 400 });
    }

    // Update password
    const hashedPassword = await hashPassword(password);
    await db.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Activate all pending memberships for this user
    await db.organizationMember.updateMany({
      where: { userId: user.id, inviteStatus: 'pending' },
      data: { inviteStatus: 'active' },
    });

    return NextResponse.json({
      success: true,
      message: 'Password set successfully. You can now log in.',
    });
  } catch (error) {
    console.error('Setup password error:', error);
    return NextResponse.json({ error: 'Failed to setup password' }, { status: 500 });
  }
}
