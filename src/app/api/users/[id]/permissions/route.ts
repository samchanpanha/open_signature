import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions'


// GET /api/users/[id]/permissions - Get all permissions for a user
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: targetUserId } = await params;
    const userId = payload.userId as string;

    // Get all permissions for the target user
    const permissions = await db.permission.findMany({
      where: { userId: targetUserId },
      include: {
        document: { select: { id: true, title: true, organizationId: true } },
        template: { select: { id: true, name: true, orgId: true } },
        grantor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get user's org memberships
    const memberships = await db.organizationMember.findMany({
      where: { userId: targetUserId },
      include: {
        org: { select: { id: true, name: true } },
      },
    });

    // Group permissions by resource type
    const documentPermissions = permissions
      .filter(p => p.document)
      .map(p => ({
        id: p.id,
        action: p.action,
        documentId: p.document!.id,
        documentTitle: p.document!.title,
        organizationId: p.document!.organizationId,
        grantedBy: p.grantor?.name || 'System',
        grantedAt: p.createdAt,
      }));

    const templatePermissions = permissions
      .filter(p => p.template)
      .map(p => ({
        id: p.id,
        action: p.action,
        templateId: p.template!.id,
        templateName: p.template!.name,
        organizationId: p.template!.orgId,
        grantedBy: p.grantor?.name || 'System',
        grantedAt: p.createdAt,
      }));

    return NextResponse.json({
      documentPermissions,
      templatePermissions,
      memberships: memberships.map(m => ({
        orgId: m.org.id,
        orgName: m.org.name,
        role: m.role,
        isActive: m.isActive,
      })),
      totalPermissions: permissions.length,
    });
  } catch (error) {
    console.error('Get user permissions error:', error);
    return NextResponse.json({ error: 'Failed to get permissions' }, { status: 500 });
  }
}
