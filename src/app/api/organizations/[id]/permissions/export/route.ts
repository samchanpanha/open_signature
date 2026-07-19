import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions'


// GET /api/organizations/[id]/permissions/export - Export permissions as CSV
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
      return NextResponse.json({ error: 'Only owner or admin can export permissions' }, { status: 403 });
    }

    // Get all permissions for this org
    const permissions = await db.permission.findMany({
      where: {
        OR: [
          { orgId },
          { document: { organizationId: orgId } },
          { template: { orgId } },
        ],
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        document: { select: { id: true, title: true } },
        template: { select: { id: true, name: true } },
        grantor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build CSV
    const csvHeader = 'User Email,User Name,Resource Type,Resource Name,Action,Granted By,Expires At,Created At\n';
    const csvRows = permissions.map(p => {
      const resourceName = p.document?.title || p.template?.name || 'Unknown';
      const resourceType = p.document ? 'Document' : p.template ? 'Template' : 'Organization';
      const expiresAt = p.expiresAt ? p.expiresAt.toISOString() : 'Never';
      const createdAt = p.createdAt.toISOString();
      const grantedBy = p.grantor?.name || 'System';
      
      // Escape CSV values
      const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;
      
      return [
        escapeCsv(p.user.email),
        escapeCsv(p.user.name),
        escapeCsv(resourceType),
        escapeCsv(resourceName),
        escapeCsv(p.action),
        escapeCsv(grantedBy),
        escapeCsv(expiresAt),
        escapeCsv(createdAt),
      ].join(',');
    }).join('\n');

    const csv = csvHeader + csvRows;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="permissions-${orgId}-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export permissions error:', error);
    return NextResponse.json({ error: 'Failed to export permissions' }, { status: 500 });
  }
}
