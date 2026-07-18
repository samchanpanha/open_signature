import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

// GET /api/documents/[id]/permissions - Get document permissions
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: docId } = await params;
    const userId = payload.userId as string;

    const doc = await db.document.findUnique({
      where: { id: docId },
      select: { organizationId: true, ownerId: true },
    });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // Get explicit permissions for this document (excluding expired)
    const permissions = await db.permission.findMany({
      where: {
        documentId: docId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Get all org members if in an org
    let orgMembers: { userId: string; role: string; user: { id: string; name: string; email: string } }[] = [];
    let orgMemberAccess: { userId: string; name: string; email: string; role: string; accessType: string }[] = [];
    
    if (doc.organizationId) {
      orgMembers = await db.organizationMember.findMany({
        where: { orgId: doc.organizationId, isActive: true },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      // Determine access for each org member
      orgMemberAccess = orgMembers.map(m => {
        // Owners and admins have full access
        if (m.role === 'owner' || m.role === 'admin') {
          return {
            userId: m.userId,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
            accessType: 'role',
          };
        }

        // Check if they have explicit permissions
        const explicitPerm = permissions.find(p => p.userId === m.userId);
        if (explicitPerm) {
          return {
            userId: m.userId,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
            accessType: 'shared',
          };
        }

        // Check role-based access (editor can create/edit, signer/viewer can view)
        return {
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
          accessType: 'role',
        };
      });
    }

    // Add owner if not in org members
    const owner = await db.user.findUnique({
      where: { id: doc.ownerId },
      select: { id: true, name: true, email: true },
    });
    if (owner && !orgMemberAccess.some(m => m.userId === owner.id)) {
      orgMemberAccess.unshift({
        userId: owner.id,
        name: owner.name,
        email: owner.email,
        role: 'owner',
        accessType: 'owner',
      });
    }

    return NextResponse.json({
      permissions: permissions.map(p => ({
        id: p.id,
        userId: p.userId,
        userName: p.user.name,
        userEmail: p.user.email,
        action: p.action,
        resource: p.resource,
      })),
      orgMembers: orgMembers.map(m => ({
        userId: m.userId,
        role: m.role,
        name: m.user.name,
        email: m.user.email,
      })),
      allAccess: orgMemberAccess,
    });
  } catch (error) {
    console.error('Get document permissions error:', error);
    return NextResponse.json({ error: 'Failed to get permissions' }, { status: 500 });
  }
}

// POST /api/documents/[id]/permissions - Add document permission
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: docId } = await params;
    const userId = payload.userId as string;
    const body = await req.json();
    const { targetUserId, action, expiresAt } = body;

    if (!targetUserId || !action) {
      return NextResponse.json({ error: 'targetUserId and action required' }, { status: 400 });
    }

    const doc = await db.document.findUnique({
      where: { id: docId },
      select: { organizationId: true, ownerId: true },
    });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // Check if user has manage permission or is owner
    if (doc.ownerId !== userId && doc.organizationId) {
      const canManage = await hasPermission(userId, doc.organizationId, 'document', 'manage');
      if (!canManage) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }

    // Create or update permission
    const existing = await db.permission.findFirst({
      where: { userId: targetUserId, documentId: docId, action },
    });

    if (existing) {
      return NextResponse.json({ message: 'Permission already exists' });
    }

    const permission = await db.permission.create({
      data: {
        userId: targetUserId,
        documentId: docId,
        action,
        resource: 'document',
        grantedBy: userId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId,
        action: 'permission_granted',
        details: `Granted ${action} permission on document to user ${targetUserId}`,
        documentId: docId,
      },
    });

    return NextResponse.json({ id: permission.id, success: true });
  } catch (error) {
    console.error('Add document permission error:', error);
    return NextResponse.json({ error: 'Failed to add permission' }, { status: 500 });
  }
}

// DELETE /api/documents/[id]/permissions - Remove document permission
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: docId } = await params;
    const userId = payload.userId as string;
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('userId');
    const action = searchParams.get('action');

    if (!targetUserId || !action) {
      return NextResponse.json({ error: 'userId and action required' }, { status: 400 });
    }

    const doc = await db.document.findUnique({
      where: { id: docId },
      select: { organizationId: true, ownerId: true },
    });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // Check permissions
    if (doc.ownerId !== userId && doc.organizationId) {
      const canManage = await hasPermission(userId, doc.organizationId, 'document', 'manage');
      if (!canManage) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }

    await db.permission.deleteMany({
      where: { userId: targetUserId, documentId: docId, action },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId,
        action: 'permission_revoked',
        details: `Revoked ${action} permission on document from user ${targetUserId}`,
        documentId: docId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove document permission error:', error);
    return NextResponse.json({ error: 'Failed to remove permission' }, { status: 500 });
  }
}
