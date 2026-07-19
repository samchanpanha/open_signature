import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions'


// GET /api/organizations/[id]/permissions/history - Get permission change history
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
      return NextResponse.json({ error: 'Only owner or admin can view permission history' }, { status: 403 });
    }

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Get permission-related audit logs for this org
    const orgMemberUserIds = (await db.organizationMember.findMany({
      where: { orgId },
      select: { userId: true },
    })).map(m => m.userId);

    const permissionActions = [
      'permission_granted',
      'permission_revoked',
      'permission_extended',
      'bulk_permissions_granted',
      'permissions_revoked_all',
    ];

    const auditLogs = await db.auditLog.findMany({
      where: {
        userId: { in: orgMemberUserIds },
        action: { in: permissionActions },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      skip: offset,
    });

    const totalCount = await db.auditLog.count({
      where: {
        userId: { in: orgMemberUserIds },
        action: { in: permissionActions },
      },
    });

    return NextResponse.json({
      history: auditLogs.map(log => ({
        id: log.id,
        userId: log.userId,
        userName: log.user?.name || 'Unknown',
        userEmail: log.user?.email || 'Unknown',
        action: log.action,
        details: log.details,
        createdAt: log.createdAt,
      })),
      totalCount,
      hasMore: offset + limit < totalCount,
    });
  } catch (error) {
    console.error('Get permission history error:', error);
    return NextResponse.json({ error: 'Failed to get permission history' }, { status: 500 });
  }
}
