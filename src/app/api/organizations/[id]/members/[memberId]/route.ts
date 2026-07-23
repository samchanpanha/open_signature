import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions'


const MANAGEABLE_ROLES = ['admin', 'editor', 'signer', 'viewer', 'member'];

// Update member role
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId, memberId } = await params;
    const userId = payload.userId as string;
    const { role, isActive, inviteStatus, branchId, departmentId, positionId } = await req.json();

    // Check caller is owner or admin
    const callerMembership = await db.organizationMember.findFirst({
      where: { orgId, userId },
    });
    if (!callerMembership || (callerMembership.role !== 'owner' && callerMembership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can change member settings' }, { status: 403 });
    }

    const member = await db.organizationMember.findFirst({
      where: { id: memberId, orgId },
    });
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    // Cannot change owner's role
    if (member.role === 'owner') {
      return NextResponse.json({ error: 'Cannot change owner role' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (role !== undefined) {
      if (!MANAGEABLE_ROLES.includes(role)) {
        return NextResponse.json({ error: `Invalid role. Must be one of: ${MANAGEABLE_ROLES.join(', ')}` }, { status: 400 });
      }
      updateData.role = role;
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }
    if (inviteStatus !== undefined) {
      updateData.inviteStatus = inviteStatus;
    }
    if (branchId !== undefined) {
      updateData.branchId = branchId || null;
    }
    if (departmentId !== undefined) {
      updateData.departmentId = departmentId || null;
    }
    if (positionId !== undefined) {
      updateData.positionId = positionId || null;
    }

    const updated = await db.organizationMember.update({
      where: { id: memberId },
      data: updateData,
      include: {
        user: { select: { id: true, email: true, name: true } },
        inviter: { select: { id: true, name: true, email: true } },
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        position: { select: { id: true, title: true, level: true } },
      },
    });

    return NextResponse.json({
      id: updated.id,
      role: updated.role,
      inviteStatus: updated.inviteStatus,
      isActive: updated.isActive,
      lastLoginAt: updated.lastLoginAt,
      joinedAt: updated.joinedAt,
      createdAt: updated.createdAt,
      user: updated.user,
      inviter: updated.inviter,
      branch: updated.branch,
      department: updated.department,
      position: updated.position,
      branchId: updated.branchId,
      departmentId: updated.departmentId,
      positionId: updated.positionId,
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
