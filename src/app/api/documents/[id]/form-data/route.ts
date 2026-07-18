import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'json';

    const document = await db.document.findFirst({
      where: { id, ownerId: payload.userId as string },
      include: {
        fields: {
          orderBy: { pageNumber: 'asc' },
          include: { signer: { select: { email: true, name: true } } },
        },
      },
    });
    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const formData = document.fields.map(f => ({
      fieldName: f.label || f.type,
      fieldType: f.type,
      pageNumber: f.pageNumber,
      value: f.value || '',
      signerEmail: f.signer?.email || '',
      signerName: f.signer?.name || '',
    }));

    if (format === 'csv') {
      const header = 'Field Name,Type,Page,Value,Signer Email,Signer Name\n';
      const rows = formData.map(f =>
        `"${f.fieldName}","${f.fieldType}","${f.pageNumber}","${(f.value || '').replace(/"/g, '""')}","${f.signerEmail}","${f.signerName}"`
      ).join('\n');
      return new NextResponse(header + rows, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${document.title}-form-data.csv"`,
        },
      });
    }

    return NextResponse.json({ documentId: id, title: document.title, fields: formData });
  } catch (error) {
    console.error('Form data export error:', error);
    return NextResponse.json({ error: 'Failed to export form data' }, { status: 500 });
  }
}
