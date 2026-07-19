import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const format = req.nextUrl.searchParams.get('format') || 'json';

    const document = await db.document.findUnique({
      where: { id },
      include: {
        signers: true,
        auditLogs: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    if (format === 'csv') {
      const headers = ['Timestamp', 'Action', 'Actor', 'Details', 'IP Address'];
      const rows = document.auditLogs.map(log => [
        log.createdAt.toISOString(),
        log.action,
        log.userId || 'System',
        log.details || '',
        log.ipAddress || '',
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-${document.title.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().slice(0,10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      document: {
        id: document.id,
        title: document.title,
        status: document.status,
        createdAt: document.createdAt,
        expiresAt: document.expiresAt,
      },
      signers: document.signers.map(s => ({
        email: s.email,
        name: s.name,
        status: s.signedAt ? 'signed' : 'pending',
        signedAt: s.signedAt,
      })),
      auditTrail: document.auditLogs.map(log => ({
        timestamp: log.createdAt,
        action: log.action,
        actor: log.userId || 'System',
        details: log.details,
        ipAddress: log.ipAddress,
      })),
      exportedAt: new Date().toISOString(),
    }, {
      headers: {
        'Content-Disposition': `attachment; filename="audit-${document.title.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().slice(0,10)}.json"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
