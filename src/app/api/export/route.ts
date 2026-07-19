import { NextRequest, NextResponse } from 'next/server';
import { PDFExporter } from '@/lib/exporters/pdf-exporter';
import { ExcelExporter } from '@/lib/exporters/excel-exporter';
import { WordExporter } from '@/lib/exporters/word-exporter';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';

// GET /api/export - Export documents in various formats
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'pdf';
    const documentId = searchParams.get('documentId');
    const templateId = searchParams.get('templateId');

    if (!documentId && !templateId) {
      return NextResponse.json(
        { error: 'documentId or templateId required' },
        { status: 400 }
      );
    }

    // Fetch document data
    let document: any = null;
    if (documentId) {
      document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          fields: true,
          signers: true,
        },
      });
    }

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check permissions
    const member = await prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId: user.id, orgId: document.organizationId! } },
    });

    if (!member && document.ownerId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let buffer: Buffer;

    switch (format.toLowerCase()) {
      case 'pdf':
        buffer = await PDFExporter.export({
          title: document.title,
          content: [
            { type: 'text', data: { text: `Document: ${document.title}`, fontSize: 16, bold: true } },
            { type: 'text', data: { text: `Status: ${document.status}` } },
            { type: 'table', data: { 
              headers: ['Field', 'Type', 'Value', 'Status'],
              rows: document.fields.map((f: any) => [
                f.label || 'Unnamed',
                f.type,
                f.value || 'Not filled',
                f.required && !f.value ? 'Required' : 'Complete'
              ])
            }},
          ],
        });
        break;

      case 'excel':
        buffer = await ExcelExporter.export({
          filename: `${document.title}.xlsx`,
          sheets: [{
            name: 'Document Data',
            columns: [
              { header: 'Field Label', key: 'label', width: 25 },
              { header: 'Type', key: 'type', width: 15 },
              { header: 'Value', key: 'value', width: 30 },
              { header: 'Required', key: 'required', width: 12 },
            ],
            rows: document.fields.map((f: any) => ({
              label: f.label || 'Unnamed',
              type: f.type,
              value: f.value || '',
              required: f.required ? 'Yes' : 'No',
            })),
          }],
        });
        break;

      case 'docx':
      case 'word':
        buffer = await WordExporter.export({
          title: document.title,
          sections: [
            { type: 'text', data: { text: `Status: ${document.status}` } },
            { type: 'heading', data: { text: 'Form Fields', level: 2 } },
            { type: 'table', data: {
              headers: ['Label', 'Type', 'Value'],
              rows: document.fields.map((f: any) => [
                f.label || 'Unnamed',
                f.type,
                f.value || 'Not filled'
              ])
            }},
          ],
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Unsupported format. Use: pdf, excel, or docx' },
          { status: 400 }
        );
    }

    const contentType = {
      pdf: 'application/pdf',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }[format.toLowerCase()] || 'application/octet-stream';

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${document.title}.${format}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting document:', error);
    return NextResponse.json(
      { error: 'Failed to export document' },
      { status: 500 }
    );
  }
}
