import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, getUserRole } from '@/lib/permissions';

// GET /api/permissions?orgId=xxx - List permissions for current user or all if admin/owner
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const orgId = url.searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Check user's role
    const role = await getUserRole(user.userId, orgId);
    if (!role) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    // Owners and admins can see all permissions, members only see their own
    const whereClause = role === 'owner' || role === 'admin' 
      ? { orgId }
      : { orgId, userId: user.userId };

    const permissions = await db.permission.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(permissions.map(p => ({
      id: p.id,
      resource: p.resource,
      action: p.action,
      granted: p.granted,
      userId: p.userId,
      orgId: p.orgId,
      user: p.user,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    })));
  } catch (error) {
    console.error('List permissions error:', error);
    return NextResponse.json({ error: 'Failed to list permissions' }, { status: 500 });
  }
}

// POST /api/permissions - Grant permission to a user
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { userId, orgId, resource, action, granted = true } = body;

    if (!userId || !orgId || !resource || !action) {
      return NextResponse.json({ 
        error: 'Missing required fields: userId, orgId, resource, action' 
      }, { status: 400 });
    }

    // Check if the requesting user has permission to grant permissions
    const requesterRole = await getUserRole(user.userId, orgId);
    if (requesterRole !== 'owner' && requesterRole !== 'admin') {
      return NextResponse.json({ 
        error: 'Forbidden: Only owners and admins can manage permissions' 
      }, { status: 403 });
    }

    // Verify target user is a member of the org
    const targetMembership = await db.organizationMember.findFirst({
      where: { userId, orgId }
    });

    if (!targetMembership) {
      return NextResponse.json({ 
        error: 'Target user is not a member of this organization' 
      }, { status: 400 });
    }

    // Create or update permission
    const permission = await db.permission.upsert({
      where: {
        userId_orgId_resource_action: {
          userId,
          orgId,
          resource,
          action
        }
      },
      update: { granted },
      create: {
        userId,
        orgId,
        resource,
        action,
        granted
      }
    });

    return NextResponse.json({
      id: permission.id,
      resource: permission.resource,
      action: permission.action,
      granted: permission.granted,
      userId: permission.userId,
      orgId: permission.orgId,
      createdAt: permission.createdAt,
      updatedAt: permission.updatedAt
    }, { status: 201 });
  } catch (error) {
    console.error('Create permission error:', error);
    return NextResponse.json({ error: 'Failed to create permission' }, { status: 500 });
  }
}

// DELETE /api/permissions?id=xxx - Revoke a permission
export async function DELETE(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const permissionId = url.searchParams.get('id');

    if (!permissionId) {
      return NextResponse.json({ error: 'Permission ID required' }, { status: 400 });
    }

    // Get the permission to check org
    const permission = await db.permission.findUnique({
      where: { id: permissionId }
    });

    if (!permission) {
      return NextResponse.json({ error: 'Permission not found' }, { status: 404 });
    }

    // Check if the requesting user has permission to revoke permissions
    const requesterRole = await getUserRole(user.userId, permission.orgId);
    if (requesterRole !== 'owner' && requesterRole !== 'admin') {
      return NextResponse.json({ 
        error: 'Forbidden: Only owners and admins can manage permissions' 
      }, { status: 403 });
    }

    await db.permission.delete({
      where: { id: permissionId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete permission error:', error);
    return NextResponse.json({ error: 'Failed to delete permission' }, { status: 500 });
  }
}
