import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions'


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

    const template = await db.documentTemplate.findUnique({
      where: { id: templateId },
      select: { ownerId: true },
    });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    // Get permissions for this template
    const permissions = await db.permission.findMany({
      where: { templateId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({
      permissions: permissions.map(p => ({
        id: p.id,
        userId: p.userId,
        userName: p.user.name,
        userEmail: p.user.email,
        action: p.action,
        resource: p.resource,
      })),
      orgMembers: [],
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

    const template = await db.documentTemplate.findUnique({
      where: { id: templateId },
      select: { ownerId: true },
    });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    // Check if user is owner
    if (template.ownerId !== userId) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
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
        details: `Granted ${action} permission on template ${templateId} to user ${targetUserId}`,
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

    const template = await db.documentTemplate.findUnique({
      where: { id: templateId },
      select: { ownerId: true },
    });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    // Check permissions
    if (template.ownerId !== userId) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await db.permission.deleteMany({
      where: { userId: targetUserId, templateId, action },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId,
        action: 'permission_revoked',
        details: `Revoked ${action} permission on template ${templateId} from user ${targetUserId}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove template permission error:', error);
    return NextResponse.json({ error: 'Failed to remove permission' }, { status: 500 });
  }
}
