import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

// List members
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId } = await params;
    const userId = payload.userId as string;

    // Check membership
    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId },
    });
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const members = await db.organizationMember.findMany({
      where: { orgId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { joinedAt: 'asc' },
    });

    return NextResponse.json(members.map(m => ({
      id: m.id,
      role: m.role,
      joinedAt: m.joinedAt,
      user: m.user,
    })));
  } catch (error) {
    console.error('List members error:', error);
    return NextResponse.json({ error: 'Failed to list members' }, { status: 500 });
  }
}

// Invite member (by email - must be existing user)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId } = await params;
    const userId = payload.userId as string;
    const { email, role = 'member' } = await req.json();

    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Only owner or admin can invite
    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can invite' }, { status: 403 });
    }

    // Find user by email
    const targetUser = await db.user.findFirst({ where: { email: email.trim().toLowerCase() } });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found. They must register first.' }, { status: 404 });
    }

    // Check if already a member
    const existing = await db.organizationMember.findFirst({
      where: { orgId, userId: targetUser.id },
    });
    if (existing) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 409 });
    }

    const member = await db.organizationMember.create({
      data: {
        userId: targetUser.id,
        orgId,
        role: role === 'admin' ? 'admin' : 'member',
      },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    return NextResponse.json({
      id: member.id,
      role: member.role,
      joinedAt: member.joinedAt,
      user: member.user,
    }, { status: 201 });
  } catch (error) {
    console.error('Invite member error:', error);
    return NextResponse.json({ error: 'Failed to invite member' }, { status: 500 });
  }
}