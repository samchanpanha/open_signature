import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { getUserRole } from '@/lib/permissions';

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

// GET /api/organizations/[id]/activity - Get activity log for org members
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId } = await params;
    const userId = payload.userId as string;

    // Check access - only owner, admin, or members with read permission
    const role = await getUserRole(userId, orgId);
    if (!role) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 });
    }

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Get all members in this org
    const memberUserIds = (await db.organizationMember.findMany({
      where: { orgId },
      select: { userId: true },
    })).map(m => m.userId);

    // Get activity logs for these users
    const activities = await db.auditLog.findMany({
      where: {
        userId: { in: memberUserIds },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        document: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      skip: offset,
    });

    // Get total count
    const totalCount = await db.auditLog.count({
      where: {
        userId: { in: memberUserIds },
      },
    });

    return NextResponse.json({
      activities: activities.map(a => ({
        id: a.id,
        action: a.action,
        details: a.details,
        ipAddress: a.ipAddress,
        createdAt: a.createdAt,
        user: a.user,
        document: a.document,
      })),
      totalCount,
      hasMore: offset + limit < totalCount,
    });
  } catch (error) {
    console.error('Get activity log error:', error);
    return NextResponse.json({ error: 'Failed to get activity log' }, { status: 500 });
  }
}
