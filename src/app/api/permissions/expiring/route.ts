import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions'


// GET /api/permissions/expiring - Get permissions expiring soon
export async function GET(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = payload.userId as string;
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '7');
    const orgId = url.searchParams.get('orgId');

    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    // Build where clause
    const whereClause: any = {
      expiresAt: {
        not: null,
        gt: now,
        lte: futureDate,
      },
    };

    // Filter by org if provided
    if (orgId) {
      whereClause.orgId = orgId;
    } else {
      // Get all orgs the user is owner/admin of
      const userOrgs = await db.organizationMember.findMany({
        where: {
          userId,
          role: { in: ['owner', 'admin'] },
        },
        select: { orgId: true },
      });
      whereClause.orgId = { in: userOrgs.map(o => o.orgId) };
    }

    const expiringPermissions = await db.permission.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, email: true } },
        document: { select: { id: true, title: true } },
        template: { select: { id: true, name: true } },
        org: { select: { id: true, name: true } },
      },
      orderBy: { expiresAt: 'asc' },
    });

    return NextResponse.json({
      permissions: expiringPermissions.map(p => ({
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
        orgId: p.orgId,
        orgName: p.org?.name,
        expiresAt: p.expiresAt,
        daysUntilExpiry: Math.ceil((p.expiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      total: expiringPermissions.length,
    });
  } catch (error) {
    console.error('Get expiring permissions error:', error);
    return NextResponse.json({ error: 'Failed to get expiring permissions' }, { status: 500 });
  }
}
