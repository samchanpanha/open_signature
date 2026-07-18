import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

// GET /api/templates/[id]/permissions - Get template permissions
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: templateId } = await params;
    const userId = payload.userId as string;

    const template = await db.template.findUnique({
      where: { id: templateId },
      select: { organizationId: true, ownerId: true },
    });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    // Get permissions for this template
    const permissions = await db.permission.findMany({
      where: { templateId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Get all org members if in an org
    let orgMembers: { userId: string; role: string; user: { id: string; name: string; email: string } }[] = [];
    if (template.organizationId) {
      orgMembers = await db.organizationMember.findMany({
        where: { orgId: template.organizationId, isActive: true },
        include: { user: { select: { id: true, name: true, email: true } } },
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
    });
  } catch (error) {
    console.error('Get template permissions error:', error);
    return NextResponse.json({ error: 'Failed to get permissions' }, { status: 500 });
  }
}

// POST /api/templates/[id]/permissions - Add template permission
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: templateId } = await params;
    const userId = payload.userId as string;
    const body = await req.json();
    const { targetUserId, action, expiresAt } = body;

    if (!targetUserId || !action) {
      return NextResponse.json({ error: 'targetUserId and action required' }, { status: 400 });
    }

    const template = await db.template.findUnique({
      where: { id: templateId },
      select: { organizationId: true, ownerId: true },
    });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    // Check if user has manage permission or is owner
    if (template.ownerId !== userId && template.organizationId) {
      const canManage = await hasPermission(userId, template.organizationId, 'template', 'manage');
      if (!canManage) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }

    // Create or update permission
    const existing = await db.permission.findFirst({
      where: { userId: targetUserId, templateId, action },
    });

    if (existing) {
      return NextResponse.json({ message: 'Permission already exists' });
    }

    const permission = await db.permission.create({
      data: {
        userId: targetUserId,
        templateId,
        action,
        resource: 'template',
        grantedBy: userId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId,
        action: 'permission_granted',
        details: `Granted ${action} permission on template to user ${targetUserId}`,
        templateId,
      },
    });

    return NextResponse.json({ id: permission.id, success: true });
  } catch (error) {
    console.error('Add template permission error:', error);
    return NextResponse.json({ error: 'Failed to add permission' }, { status: 500 });
  }
}

// DELETE /api/templates/[id]/permissions - Remove template permission
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: templateId } = await params;
    const userId = payload.userId as string;
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('userId');
    const action = searchParams.get('action');

    if (!targetUserId || !action) {
      return NextResponse.json({ error: 'userId and action required' }, { status: 400 });
    }

    const template = await db.template.findUnique({
      where: { id: templateId },
      select: { organizationId: true, ownerId: true },
    });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    // Check permissions
    if (template.ownerId !== userId && template.organizationId) {
      const canManage = await hasPermission(userId, template.organizationId, 'template', 'manage');
      if (!canManage) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }

    await db.permission.deleteMany({
      where: { userId: targetUserId, templateId, action },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId,
        action: 'permission_revoked',
        details: `Revoked ${action} permission on template from user ${targetUserId}`,
        templateId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove template permission error:', error);
    return NextResponse.json({ error: 'Failed to remove permission' }, { status: 500 });
  }
}
