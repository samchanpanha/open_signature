import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, hasPermission, getUserRoles, hasDocumentPermission } from '@/lib/permissions';

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

    // Get document-level permissions (from new DocumentPermission model)
    const docPermissions = await db.documentPermission.findMany({
      where: {
        documentId: docId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get legacy permissions
    const legacyPermissions = await db.permission.findMany({
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

    // Get org members if in an org
    let orgMembers: any[] = [];
    if (doc.organizationId) {
      orgMembers = await db.organizationMember.findMany({
        where: { orgId: doc.organizationId, isActive: true },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
    }

    // Build access list
    const allAccess: any[] = [];

    // Add owner
    const owner = await db.user.findUnique({
      where: { id: doc.ownerId },
      select: { id: true, name: true, email: true },
    });
    if (owner) {
      allAccess.push({
        userId: owner.id,
        name: owner.name,
        email: owner.email,
        role: 'owner',
        permissions: ['read', 'comment', 'sign', 'edit', 'delete', 'share'],
        accessType: 'owner',
      });
    }

    // Add org members with their roles
    for (const m of orgMembers) {
      if (m.userId === doc.ownerId) continue;
      const roles = (() => {
        try { const p = JSON.parse(m.roles); return Array.isArray(p) && p.length > 0 ? p : [m.role]; }
        catch { return [m.role]; }
      })();

      const isPrivileged = roles.includes('owner') || roles.includes('admin');
      const existingDocPerm = docPermissions.find((p) => p.userId === m.userId);

      allAccess.push({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        roles,
        permissions: existingDocPerm
          ? JSON.parse(existingDocPerm.permissions || '["read"]')
          : isPrivileged
            ? ['read', 'comment', 'sign', 'edit', 'delete', 'share']
            : roles.includes('editor')
              ? ['read', 'comment', 'sign', 'edit']
              : roles.includes('signer')
                ? ['read', 'comment', 'sign']
                : ['read'],
        accessType: existingDocPerm ? 'shared' : 'role',
        docPermissionId: existingDocPerm?.id,
      });
    }

    // Add external document permissions (users not in org)
    for (const dp of docPermissions) {
      if (dp.userId && !allAccess.some((a) => a.userId === dp.userId)) {
        allAccess.push({
          userId: dp.userId,
          email: dp.email,
          name: dp.email,
          role: dp.role,
          permissions: JSON.parse(dp.permissions || '["read"]'),
          accessType: 'shared',
          docPermissionId: dp.id,
          expiresAt: dp.expiresAt,
        });
      }
      if (!dp.userId && dp.email) {
        allAccess.push({
          email: dp.email,
          name: dp.email,
          role: dp.role,
          permissions: JSON.parse(dp.permissions || '["read"]'),
          accessType: 'shared',
          docPermissionId: dp.id,
          expiresAt: dp.expiresAt,
        });
      }
    }

    return NextResponse.json({
      docPermissions: docPermissions.map((p) => ({
        id: p.id,
        userId: p.userId,
        email: p.email,
        role: p.role,
        permissions: JSON.parse(p.permissions || '["read"]'),
        expiresAt: p.expiresAt,
        createdAt: p.createdAt,
      })),
      legacyPermissions: legacyPermissions.map((p) => ({
        id: p.id,
        userId: p.userId,
        userName: p.user.name,
        userEmail: p.user.email,
        action: p.action,
      })),
      allAccess,
      roles: ['viewer', 'commenter', 'signer', 'editor', 'admin'],
      permissionActions: ['read', 'comment', 'sign', 'edit', 'delete', 'share'],
    });
  } catch (error) {
    console.error('Get document permissions error:', error);
    return NextResponse.json({ error: 'Failed to get permissions' }, { status: 500 });
  }
}

// POST /api/documents/[id]/permissions - Grant document permission
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
    const { targetUserId, email, role, permissions, expiresAt } = body;

    if (!role) {
      return NextResponse.json({ error: 'role is required' }, { status: 400 });
    }
    if (!targetUserId && !email) {
      return NextResponse.json({ error: 'targetUserId or email is required' }, { status: 400 });
    }

    const doc = await db.document.findUnique({
      where: { id: docId },
      select: { organizationId: true, ownerId: true },
    });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // Check if user can manage
    if (doc.ownerId !== userId) {
      if (doc.organizationId) {
        const canManage = await hasPermission(userId, doc.organizationId, 'document', 'update');
        if (!canManage) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: 'Only document owner can manage permissions' }, { status: 403 });
      }
    }

    // Resolve permissions from role if not explicitly provided
    const ROLE_DEFAULTS: Record<string, string[]> = {
      admin: ['read', 'comment', 'sign', 'edit', 'delete', 'share'],
      editor: ['read', 'comment', 'sign', 'edit'],
      signer: ['read', 'comment', 'sign'],
      commenter: ['read', 'comment'],
      viewer: ['read'],
    };
    const finalPermissions = permissions || ROLE_DEFAULTS[role] || ['read'];

    // Create or update
    const data: any = {
      documentId: docId,
      userId: targetUserId || null,
      email: email || null,
      role,
      permissions: JSON.stringify(finalPermissions),
      grantedBy: userId,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    };

    let docPerm;
    if (targetUserId) {
      const existing = await db.documentPermission.findFirst({
        where: { documentId: docId, userId: targetUserId },
      });
      if (existing) {
        docPerm = await db.documentPermission.update({
          where: { id: existing.id },
          data: { role, permissions: JSON.stringify(finalPermissions), expiresAt: expiresAt ? new Date(expiresAt) : null },
        });
      } else {
        docPerm = await db.documentPermission.create({ data });
      }
    } else if (email) {
      const existing = await db.documentPermission.findFirst({
        where: { documentId: docId, email },
      });
      if (existing) {
        docPerm = await db.documentPermission.update({
          where: { id: existing.id },
          data: { role, permissions: JSON.stringify(finalPermissions), expiresAt: expiresAt ? new Date(expiresAt) : null },
        });
      } else {
        docPerm = await db.documentPermission.create({ data });
      }
    }

    // Audit log
    await db.auditLog.create({
      data: {
        userId,
        action: 'DOCUMENT_PERMISSION_GRANTED',
        details: `Granted ${role} role with [${finalPermissions.join(', ')}] on document to ${targetUserId || email}`,
        documentId: docId,
      },
    });

    return NextResponse.json({ id: docPerm?.id, success: true, role, permissions: finalPermissions });
  } catch (error) {
    console.error('Add document permission error:', error);
    return NextResponse.json({ error: 'Failed to add permission' }, { status: 500 });
  }
}

// DELETE /api/documents/[id]/permissions - Revoke document permission
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
    const permId = searchParams.get('permId');
    const targetUserId = searchParams.get('userId');

    if (!permId && !targetUserId) {
      return NextResponse.json({ error: 'permId or userId required' }, { status: 400 });
    }

    const doc = await db.document.findUnique({
      where: { id: docId },
      select: { organizationId: true, ownerId: true },
    });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    if (doc.ownerId !== userId) {
      if (doc.organizationId) {
        const canManage = await hasPermission(userId, doc.organizationId, 'document', 'update');
        if (!canManage) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: 'Only document owner can manage permissions' }, { status: 403 });
      }
    }

    if (permId) {
      await db.documentPermission.delete({ where: { id: permId } });
    } else if (targetUserId) {
      await db.documentPermission.deleteMany({
        where: { documentId: docId, userId: targetUserId },
      });
    }

    // Audit log
    await db.auditLog.create({
      data: {
        userId,
        action: 'DOCUMENT_PERMISSION_REVOKED',
        details: `Revoked permission on document from ${targetUserId || permId}`,
        documentId: docId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove document permission error:', error);
    return NextResponse.json({ error: 'Failed to remove permission' }, { status: 500 });
  }
}
