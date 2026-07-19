import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions'


// POST /api/organizations/[id]/permission-templates/[templateId]/apply - Apply template to a member
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId, templateId } = await params;
    const userId = payload.userId as string;

    // Check if user is owner or admin
    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can apply templates' }, { status: 403 });
    }

    const body = await req.json();
    const { targetUserId } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: 'Target user ID required' }, { status: 400 });
    }

    // Get the template
    const template = await db.permissionTemplate.findFirst({
      where: { id: templateId, orgId },
    });
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Parse permissions from template
    const permissions = JSON.parse(template.permissions) as Array<{
      resource: string;
      action: string;
    }>;

    // Apply permissions to target user
    const grantedPermissions: { id: string }[] = [];
    for (const perm of permissions) {
      try {
        const existing = await db.permission.findFirst({
          where: {
            userId: targetUserId,
            orgId,
            resource: perm.resource,
            action: perm.action,
          },
        });

        if (!existing) {
          const newPerm = await db.permission.create({
            data: {
              userId: targetUserId,
              orgId,
              resource: perm.resource,
              action: perm.action,
              granted: true,
              grantedBy: userId,
            },
          });
          grantedPermissions.push(newPerm);
        }
      } catch (e) {
        // Skip duplicate or invalid permissions
      }
    }

    // Log the action
    await db.auditLog.create({
      data: {
        userId,
        action: 'template_applied',
        details: `Applied template "${template.name}" to user ${targetUserId}: ${grantedPermissions.length} permissions granted`,
      },
    });

    return NextResponse.json({
      templateName: template.name,
      permissionsApplied: grantedPermissions.length,
    });
  } catch (error) {
    console.error('Apply permission template error:', error);
    return NextResponse.json({ error: 'Failed to apply permission template' }, { status: 500 });
  }
}
