import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions'


// POST /api/users/[id]/permissions/revoke-all - Revoke all permissions for a user in an org
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: targetUserId } = await params;
    const userId = payload.userId as string;
    const body = await req.json();
    const { orgId } = body;

    if (!orgId) {
      return NextResponse.json({ error: 'orgId required' }, { status: 400 });
    }

    // Check if caller is owner or admin
    const callerMembership = await db.organizationMember.findFirst({
      where: { orgId, userId },
    });
    if (!callerMembership || (callerMembership.role !== 'owner' && callerMembership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can revoke permissions' }, { status: 403 });
    }

    // Find all permissions for the target user in this org (via documents and templates)
    const orgDocs = await db.document.findMany({
      where: { organizationId: orgId },
      select: { id: true },
    });
    const orgTemplates = await db.formTemplate.findMany({
      where: { orgId },
      select: { id: true },
    });

    const docIds = orgDocs.map(d => d.id);
    const templateIds = orgTemplates.map(t => t.id);

    // Delete all permissions for the target user on org resources
    const result = await db.permission.deleteMany({
      where: {
        userId: targetUserId,
        OR: [
          { documentId: { in: docIds } },
          { templateId: { in: templateIds } },
        ],
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId,
        action: 'permissions_revoked_all',
        details: `Revoked ${result.count} permissions for user ${targetUserId} in org`,
      },
    });

    return NextResponse.json({
      success: true,
      revoked: result.count,
    });
  } catch (error) {
    console.error('Revoke all permissions error:', error);
    return NextResponse.json({ error: 'Failed to revoke permissions' }, { status: 500 });
  }
}
