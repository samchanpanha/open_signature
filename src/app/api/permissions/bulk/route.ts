import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, hasPermission } from '@/lib/permissions'


interface BulkPermissionItem {
  userId: string;
  documentId?: string;
  templateId?: string;
  action: string;
}

// POST /api/permissions/bulk - Set multiple permissions at once
export async function POST(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = payload.userId as string;
    const body = await req.json();
    const { permissions, orgId } = body as { permissions: BulkPermissionItem[]; orgId?: string };

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return NextResponse.json({ error: 'permissions array required' }, { status: 400 });
    }

    // Validate all permissions have required fields
    for (const perm of permissions) {
      if (!perm.userId || !perm.action) {
        return NextResponse.json({ error: 'Each permission needs userId and action' }, { status: 400 });
      }
      if (!perm.documentId && !perm.templateId) {
        return NextResponse.json({ error: 'Each permission needs documentId or templateId' }, { status: 400 });
      }
    }

    // Check permissions for each resource
    if (orgId) {
      const canManage = await hasPermission(userId, orgId, 'document', 'manage');
      if (!canManage) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }

    const results = await db.$transaction(async (tx) => {
      const created: string[] = [];
      
      for (const perm of permissions) {
        // Check if already exists
        const existing = await tx.permission.findFirst({
          where: {
            userId: perm.userId,
            ...(perm.documentId ? { documentId: perm.documentId } : { templateId: perm.templateId }),
            action: perm.action,
          },
        });

        if (!existing) {
          const newPerm = await tx.permission.create({
            data: {
              userId: perm.userId,
              ...(perm.documentId ? { documentId: perm.documentId } : { templateId: perm.templateId }),
              action: perm.action,
              resource: perm.documentId ? 'document' : 'template',
              grantedBy: userId,
            },
          });
          created.push(newPerm.id);
        }
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'bulk_permissions_granted',
          details: `Bulk granted ${created.length} permissions`,
        },
      });

      return { created: created.length, skipped: permissions.length - created.length };
    });

    return NextResponse.json({
      success: true,
      created: results.created,
      skipped: results.skipped,
    });
  } catch (error) {
    console.error('Bulk permissions error:', error);
    return NextResponse.json({ error: 'Failed to set permissions' }, { status: 500 });
  }
}
