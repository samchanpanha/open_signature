import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

// GET /api/organizations/[id]/permissions - Get all permissions for an org
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId } = await params;
    const userId = payload.userId as string;

    // Check if user is owner or admin
    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can view all permissions' }, { status: 403 });
    }

    const url = new URL(req.url);
    const resourceType = url.searchParams.get('resource'); // 'document' | 'template' | null (all)
    const includeExpired = url.searchParams.get('includeExpired') === 'true';

    // Build where clause
    const whereClause: any = {
      OR: [
        { orgId },
        { document: { organizationId: orgId } },
        { template: { orgId } },
      ],
    };

    if (resourceType) {
      whereClause.resource = resourceType;
    }

    if (!includeExpired) {
      whereClause.AND = [
        {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      ];
    }

    const permissions = await db.permission.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, email: true } },
        document: { select: { id: true, title: true, organizationId: true } },
        template: { select: { id: true, name: true, orgId: true } },
        grantor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by user
    const userPermissions = new Map<string, {
      userId: string;
      userName: string;
      userEmail: string;
      documentCount: number;
      templateCount: number;
      permissions: typeof permissions;
    }>();

    for (const perm of permissions) {
      const existing = userPermissions.get(perm.userId);
      if (existing) {
        existing.documentCount += perm.document ? 1 : 0;
        existing.templateCount += perm.template ? 1 : 0;
        existing.permissions.push(perm);
      } else {
        userPermissions.set(perm.userId, {
          userId: perm.userId,
          userName: perm.user.name,
          userEmail: perm.user.email,
          documentCount: perm.document ? 1 : 0,
          templateCount: perm.template ? 1 : 0,
          permissions: [perm],
        });
      }
    }

    return NextResponse.json({
      permissions: permissions.map(p => ({
        id: p.id,
        userId: p.userId,
        userName: p.user.name,
        userEmail: p.user.email,
        action: p.action,
        resource: p.resource,
        documentId: p.documentId,
        documentTitle: p.document?.title,
        templateId: p.templateId,
        templateName: p.template?.name,
        grantedBy: p.grantor?.name || 'System',
        expiresAt: p.expiresAt,
        createdAt: p.createdAt,
      })),
      byUser: Array.from(userPermissions.values()),
      total: permissions.length,
    });
  } catch (error) {
    console.error('Get org permissions error:', error);
    return NextResponse.json({ error: 'Failed to get permissions' }, { status: 500 });
  }
}
