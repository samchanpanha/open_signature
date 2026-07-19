import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions'


// POST /api/permissions/[id]/extend - Extend permission expiration
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: permissionId } = await params;
    const userId = payload.userId as string;
    const body = await req.json();
    const { days } = body;

    if (!days || days <= 0) {
      return NextResponse.json({ error: 'days must be a positive number' }, { status: 400 });
    }

    // Get the permission
    const permission = await db.permission.findUnique({
      where: { id: permissionId },
      include: {
        org: { select: { id: true } },
      },
    });

    if (!permission) {
      return NextResponse.json({ error: 'Permission not found' }, { status: 404 });
    }

    // Check if user has permission to extend (owner/admin of the org)
    if (permission.orgId) {
      const callerMembership = await db.organizationMember.findFirst({
        where: { orgId: permission.orgId, userId },
      });
      if (!callerMembership || (callerMembership.role !== 'owner' && callerMembership.role !== 'admin')) {
        return NextResponse.json({ error: 'Only owner or admin can extend permissions' }, { status: 403 });
      }
    }

    // Calculate new expiration date
    const currentExpiry = permission.expiresAt || new Date();
    const newExpiry = new Date(currentExpiry.getTime() + days * 24 * 60 * 60 * 1000);

    // Update the permission
    await db.permission.update({
      where: { id: permissionId },
      data: { expiresAt: newExpiry },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId,
        action: 'permission_extended',
        details: `Extended permission by ${days} days (new expiry: ${newExpiry.toISOString()})`,
      },
    });

    return NextResponse.json({
      success: true,
      newExpiresAt: newExpiry,
    });
  } catch (error) {
    console.error('Extend permission error:', error);
    return NextResponse.json({ error: 'Failed to extend permission' }, { status: 500 });
  }
}
