import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const { user, error } = await requireSuperAdmin(req);
  if (error) return error;

  const [totalUsers, totalOrgs, totalDocuments, totalSigners, recentAuditLogs, documentsByStatus, usersCreatedLast7Days] = await Promise.all([
    db.user.count(),
    db.organization.count(),
    db.document.count(),
    db.signer.count(),
    db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20, include: { user: { select: { name: true, email: true } } } }),
    db.document.groupBy({ by: ['status'], _count: true }),
    db.user.findMany({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }, select: { id: true, createdAt: true } }),
  ]);

  const statusMap: Record<string, number> = {};
  documentsByStatus.forEach(s => { statusMap[s.status] = s._count; });

  return NextResponse.json({
    stats: {
      totalUsers,
      totalOrgs,
      totalDocuments,
      totalSigners,
      totalAuditLogs: await db.auditLog.count(),
      usersLast7Days: usersCreatedLast7Days.length,
    },
    documentsByStatus: statusMap,
    recentAuditLogs: recentAuditLogs.map(l => ({
      id: l.id, action: l.action, details: l.details, resourceType: l.resourceType,
      createdAt: l.createdAt, userName: l.user?.name || l.user?.email || 'System',
    })),
  });
}
