import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, getUserRole, ROLE_PRESETS } from '@/lib/permissions';

// POST /api/permissions/batch - Apply role preset permissions to a user
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, orgId, role } = await req.json();

    if (!userId || !orgId || !role) {
      return NextResponse.json({
        error: 'Missing required fields: userId, orgId, role'
      }, { status: 400 });
    }

    // Check if the requesting user has permission
    const requesterRole = await getUserRole(user.userId, orgId);
    if (requesterRole !== 'owner' && requesterRole !== 'admin') {
      return NextResponse.json({
        error: 'Forbidden: Only owners and admins can manage permissions'
      }, { status: 403 });
    }

    // Verify target user is a member
    const targetMembership = await db.organizationMember.findFirst({
      where: { userId, orgId }
    });
    if (!targetMembership) {
      return NextResponse.json({
        error: 'Target user is not a member of this organization'
      }, { status: 400 });
    }

    const preset = ROLE_PRESETS[role];
    if (!preset) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Delete existing permissions for this user in this org
    await db.permission.deleteMany({
      where: { userId, orgId }
    });

    // If role has permissions (not owner/admin which bypass), create them
    if (preset.permissions.length > 0) {
      await db.permission.createMany({
        data: preset.permissions.map(p => ({
          userId,
          orgId,
          resource: p.resource,
          action: p.action,
          granted: true,
        })),
      });
    }

    // Update the member's role
    await db.organizationMember.updateMany({
      where: { userId, orgId },
      data: { role },
    });

    return NextResponse.json({
      success: true,
      role,
      permissionsCreated: preset.permissions.length,
    });
  } catch (error) {
    console.error('Batch permissions error:', error);
    return NextResponse.json({ error: 'Failed to apply permissions' }, { status: 500 });
  }
}
