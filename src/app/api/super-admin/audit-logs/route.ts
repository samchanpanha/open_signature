import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const { user, error } = await requireSuperAdmin(req);
  if (error) return error;

  const url = new URL(req.url);
  const search = url.searchParams.get('search') || '';
  const action = url.searchParams.get('action') || '';
  const resourceType = url.searchParams.get('resourceType') || '';
  const userId = url.searchParams.get('userId') || '';
  const orgId = url.searchParams.get('orgId') || '';
  const startDate = url.searchParams.get('startDate') || '';
  const endDate = url.searchParams.get('endDate') || '';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { action: { contains: search } },
      { details: { contains: search } },
      { path: { contains: search } },
    ];
  }
  if (action) where.action = action;
  if (resourceType) where.resourceType = resourceType;
  if (userId) where.userId = userId;
  if (orgId) where.orgId = orgId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) (where.createdAt as Record<string, Date>).gte = new Date(startDate);
    if (endDate) (where.createdAt as Record<string, Date>).lte = new Date(endDate + 'T23:59:59.999Z');
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.auditLog.count({ where }),
  ]);

  const actions = await db.auditLog.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } });
  const resourceTypes = await db.auditLog.findMany({ distinct: ['resourceType'], select: { resourceType: true }, orderBy: { resourceType: 'asc' } });

  return NextResponse.json({
    logs: logs.map(l => ({
      id: l.id, action: l.action, details: l.details, resourceType: l.resourceType,
      resourceId: l.resourceId, method: l.method, path: l.path, statusCode: l.statusCode,
      duration: l.duration, ipAddress: l.ipAddress, createdAt: l.createdAt,
      userName: l.user?.name || l.user?.email || 'System',
      userId: l.userId,
    })),
    total, page, limit,
    filters: {
      actions: actions.map(a => a.action).filter(Boolean),
      resourceTypes: resourceTypes.map(r => r.resourceType).filter(Boolean),
    },
  });
}
