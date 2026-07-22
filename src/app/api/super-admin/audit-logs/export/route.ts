import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const { user, error } = await requireSuperAdmin(req);
  if (error) return error;

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || '';
  const resourceType = url.searchParams.get('resourceType') || '';
  const startDate = url.searchParams.get('startDate') || '';
  const endDate = url.searchParams.get('endDate') || '';

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (resourceType) where.resourceType = resourceType;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) (where.createdAt as Record<string, Date>).gte = new Date(startDate);
    if (endDate) (where.createdAt as Record<string, Date>).lte = new Date(endDate + 'T23:59:59.999Z');
  }

  const logs = await db.auditLog.findMany({
    where,
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10000,
  });

  const header = 'Timestamp,Action,User,Resource Type,Resource ID,Method,Path,Status Code,IP Address,Details\n';
  const rows = logs.map(l => {
    const ts = l.createdAt.toISOString();
    const userName = (l.user?.name || l.user?.email || 'System').replace(/,/g, ';');
    const details = (l.details || '').replace(/,/g, ';').replace(/\n/g, ' ');
    return `${ts},${l.action},${userName},${l.resourceType || ''},${l.resourceId || ''},${l.method || ''},${l.path || ''},${l.statusCode || ''},${l.ipAddress || ''},${details}`;
  }).join('\n');

  return new NextResponse(header + rows, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}
