import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth'
import crypto from 'crypto';
import { getAuthUser } from '@/lib/permissions'


const MANAGEABLE_ROLES = ['admin', 'editor', 'signer', 'viewer', 'member'];

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
      include: {
        user: { select: { id: true, email: true, name: true } },
        inviter: { select: { id: true, name: true, email: true } },
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        position: { select: { id: true, title: true, level: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(members.map(m => ({
      id: m.id,
      role: m.role,
      inviteStatus: m.inviteStatus,
      isActive: m.isActive,
      lastLoginAt: m.lastLoginAt,
      joinedAt: m.joinedAt,
      createdAt: m.createdAt,
      user: m.user,
      inviter: m.inviter,
      branch: m.branch,
      department: m.department,
      position: m.position,
      branchId: m.branchId,
      departmentId: m.departmentId,
      positionId: m.positionId,
    })));
  } catch (error) {
    console.error('List members error:', error);
    return NextResponse.json({ error: 'Failed to list members' }, { status: 500 });
  }
}

// Invite or create sub-member
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId } = await params;
    const userId = payload.userId as string;
    const { email, name, role = 'member', password, branchId, departmentId, positionId } = await req.json();

    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Only owner or admin can invite
    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can invite members' }, { status: 403 });
    }

    // Validate role
    if (!MANAGEABLE_ROLES.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${MANAGEABLE_ROLES.join(', ')}` }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    let targetUser = await db.user.findFirst({ where: { email: normalizedEmail } });
    let tempPassword: string | null = null;
    let isNewUser = false;

    if (!targetUser) {
      // Auto-create user account with provided or generated password
      tempPassword = password || crypto.randomBytes(8).toString('hex');
      const hashedPassword = await hashPassword(tempPassword!);

      targetUser = await db.user.create({
        data: {
          email: normalizedEmail,
          name: name || normalizedEmail.split('@')[0],
          password: hashedPassword,
        },
      });
      isNewUser = true;
    }

    // Check if already a member
    const existing = await db.organizationMember.findFirst({
      where: { orgId, userId: targetUser.id },
    });
    if (existing) {
      return NextResponse.json({ error: 'User is already a member of this organization' }, { status: 409 });
    }

    const member = await db.organizationMember.create({
      data: {
        userId: targetUser.id,
        orgId,
        role,
        inviteStatus: isNewUser ? 'pending' : 'active',
        invitedBy: userId,
        branchId: branchId || null,
        departmentId: departmentId || null,
        positionId: positionId || null,
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
        inviter: { select: { id: true, name: true, email: true } },
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        position: { select: { id: true, title: true, level: true } },
      },
    });

    return NextResponse.json({
      id: member.id,
      role: member.role,
      inviteStatus: member.inviteStatus,
      isActive: member.isActive,
      joinedAt: member.joinedAt,
      createdAt: member.createdAt,
      user: member.user,
      inviter: member.inviter,
      branch: member.branch,
      department: member.department,
      position: member.position,
      branchId: member.branchId,
      departmentId: member.departmentId,
      positionId: member.positionId,
      isNewUser,
    }, { status: 201 });
  } catch (error) {
    console.error('Invite member error:', error);
    return NextResponse.json({ error: 'Failed to invite member' }, { status: 500 });
  }
}
