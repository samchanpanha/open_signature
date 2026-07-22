import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/permissions';
import { createAuditLog, auditFromRequest } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const { user, error } = await requireSuperAdmin(req);
  if (error) return error;

  const url = new URL(req.url);
  const search = url.searchParams.get('search') || '';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const skip = (page - 1) * limit;

  const where = search ? {
    OR: [
      { email: { contains: search } },
      { name: { contains: search } },
    ],
  } : {};

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true, email: true, name: true, isSuperAdmin: true, createdAt: true,
        _count: { select: { documents: true, organizationMembers: true, auditLogs: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, limit });
}

export async function PUT(req: NextRequest) {
  const { user, error } = await requireSuperAdmin(req);
  if (error) return error;

  const body = await req.json();
  const { userId, isSuperAdmin, name, email } = body;

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const updateData: Record<string, unknown> = {};
  if (isSuperAdmin !== undefined) updateData.isSuperAdmin = isSuperAdmin;
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;

  const updated = await db.user.update({ where: { id: userId }, data: updateData, select: { id: true, email: true, name: true, isSuperAdmin: true } });

  await createAuditLog(auditFromRequest(req, {
    action: 'SUPER_ADMIN_UPDATE_USER',
    userId: user.userId,
    resourceType: 'user',
    resourceId: userId,
    details: `Updated user ${updated.email}: ${Object.keys(updateData).join(', ')}`,
    metadata: { targetUserId: userId, changes: updateData },
  }));

  return NextResponse.json({ user: updated });
}

export async function DELETE(req: NextRequest) {
  const { user, error } = await requireSuperAdmin(req);
  if (error) return error;

  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const target = await db.user.findUnique({ where: { id: userId }, select: { email: true, isSuperAdmin: true } });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (target.isSuperAdmin) return NextResponse.json({ error: 'Cannot delete super admin' }, { status: 400 });

  await createAuditLog(auditFromRequest(req, {
    action: 'SUPER_ADMIN_DELETE_USER',
    userId: user.userId,
    resourceType: 'user',
    resourceId: userId,
    details: `Deleted user ${target.email}`,
  }));

  await db.user.delete({ where: { id: userId } });
  return NextResponse.json({ success: true });
}
