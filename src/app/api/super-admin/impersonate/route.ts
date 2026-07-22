import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/permissions';
import { generateToken } from '@/lib/auth';
import { createAuditLog, auditFromRequest } from '@/lib/audit';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { user, error } = await requireSuperAdmin(req);
  if (error) return error;

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, isSuperAdmin: true } });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const token = generateToken({ userId: target.id, email: target.email, name: target.name, isSuperAdmin: target.isSuperAdmin });

  await createAuditLog(auditFromRequest(req, {
    action: 'SUPER_ADMIN_IMPERSONATE',
    userId: user.userId,
    resourceType: 'user',
    resourceId: userId,
    details: `Admin ${user.email} impersonated user ${target.email}`,
  }));

  return NextResponse.json({ token, user: { id: target.id, email: target.email, name: target.name, isSuperAdmin: target.isSuperAdmin } });
}
