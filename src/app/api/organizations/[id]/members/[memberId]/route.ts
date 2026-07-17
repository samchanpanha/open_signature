import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

// Update member role
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId, memberId } = await params;
    const userId = payload.userId as string;
    const { role } = await req.json();

    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Check caller is owner or admin
    const callerMembership = await db.organizationMember.findFirst({
      where: { orgId, userId },
    });
    if (!callerMembership || (callerMembership.role !== 'owner' && callerMembership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can change roles' }, { status: 403 });
    }

    const member = await db.organizationMember.findFirst({
      where: { id: memberId, orgId },
    });
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    // Cannot change owner's role
    if (member.role === 'owner') {
      return NextResponse.json({ error: 'Cannot change owner role' }, { status: 400 });
    }

    const updated = await db.organizationMember.update({
      where: { id: memberId },
      data: { role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    return NextResponse.json({
      id: updated.id,
      role: updated.role,
      joinedAt: updated.joinedAt,
      user: updated.user,
    });
  } catch (error) {
    console.error('Update member error:', error);
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }
}

// Remove member
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId, memberId } = await params;
    const userId = payload.userId as string;

    // Check caller is owner or admin
    const callerMembership = await db.organizationMember.findFirst({
      where: { orgId, userId },
    });
    if (!callerMembership || (callerMembership.role !== 'owner' && callerMembership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can remove members' }, { status: 403 });
    }

    const member = await db.organizationMember.findFirst({
      where: { id: memberId, orgId },
    });
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    // Cannot remove owner
    if (member.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove the owner' }, { status: 400 });
    }

    // Admin cannot remove another admin (only owner can)
    if (callerMembership.role === 'admin' && member.role === 'admin') {
      return NextResponse.json({ error: 'Admins cannot remove other admins' }, { status: 403 });
    }

    await db.organizationMember.delete({ where: { id: memberId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove member error:', error);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}