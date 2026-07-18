import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

// GET /api/analytics - Return usage stats for the authenticated user's organization
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.userId as string;

    const [documents, templates, contacts, workflows, recentLogs] = await Promise.all([
      db.document.findMany({
        where: {
          OR: [
            { ownerId: userId },
            { organizationId: user.orgId as string | undefined },
          ],
        },
        include: {
          signers: { select: { signedAt: true, rejectedAt: true } },
        },
      }),
      db.documentTemplate.findMany({
        where: { ownerId: userId },
        select: { id: true },
      }),
      db.contact.findMany({
        where: { userId },
        select: { id: true },
      }),
      db.signatureWorkflow.findMany({
        where: {
          OR: [
            { createdBy: userId },
            { orgId: user.orgId as string | undefined },
          ],
        },
        select: { id: true },
      }),
      db.auditLog.findMany({
        where: {
          OR: [
            { userId },
            { document: { ownerId: userId } },
            { document: { organizationId: user.orgId as string | undefined } },
          ],
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const documentsCreated = documents.length;
    const documentsCompleted = documents.filter((d) => d.status === 'Completed').length;
    const documentsSent = documents.filter((d) => d.status === 'Sent' || d.status === 'Signing').length;
    const documentsExpired = documents.filter((d) => d.status === 'Expired').length;
    const documentsRevoked = documents.filter((d) => d.status === 'Revoked').length;
    const documentsRejected = documents.filter((d) => d.status === 'Rejected').length;

    let totalSigners = 0;
    let completedSigners = 0;

    for (const doc of documents) {
      totalSigners += doc.signers.length;
      completedSigners += doc.signers.filter((s) => s.signedAt && !s.rejectedAt).length;
    }

    return NextResponse.json({
      documents: {
        created: documentsCreated,
        completed: documentsCompleted,
        sent: documentsSent,
        expired: documentsExpired,
        revoked: documentsRevoked,
        rejected: documentsRejected,
      },
      signers: {
        total: totalSigners,
        completed: completedSigners,
      },
      templates: templates.length,
      contacts: contacts.length,
      workflows: workflows.length,
      recentActivity: recentLogs,
    });
  } catch (error) {
    console.error('Analytics GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

// POST /api/analytics - Record a usage stat (internal use)
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { metric, value, orgId } = await req.json();

    if (!metric) {
      return NextResponse.json({ error: 'metric is required' }, { status: 400 });
    }

    const userId = user.userId as string;
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const stat = await db.usageStat.upsert({
      where: {
        userId_orgId_metric_period: {
          userId,
          orgId: orgId || null,
          metric,
          period,
        },
      },
      update: {
        value: { increment: value ?? 1 },
      },
      create: {
        userId,
        orgId: orgId || null,
        metric,
        value: value ?? 1,
        period,
      },
    });

    return NextResponse.json({ stat }, { status: 201 });
  } catch (error) {
    console.error('Analytics POST error:', error);
    return NextResponse.json({ error: 'Failed to record analytics' }, { status: 500 });
  }
}
