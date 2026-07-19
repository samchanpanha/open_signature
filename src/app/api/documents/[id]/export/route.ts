import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PDFDocument } from 'pdf-lib';
import { getAuthUser } from '@/lib/permissions';
import { readPdfStorage } from '@/lib/s3';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'pdf';
    const pagesParam = searchParams.get('pages');

    const document = await db.document.findFirst({
      where: { id, ownerId: payload.userId as string },
    });
    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const pdfPath = document.signedPdfPath || document.originalPdfPath;
    const pdfBytes = await readPdfStorage(pdfPath);

    if (format === 'pages' && pagesParam) {
      const pageNumbers = pagesParam.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
      const srcDoc = await PDFDocument.load(pdfBytes);
      const newDoc = await PDFDocument.create();
      
      for (const pageNum of pageNumbers) {
        if (pageNum >= 1 && pageNum <= srcDoc.getPageCount()) {
          const [copiedPage] = await newDoc.copyPages(srcDoc, [pageNum - 1]);
          newDoc.addPage(copiedPage);
        }
      }
      
      const exportedBytes = await newDoc.save();
      return new NextResponse(Buffer.from(exportedBytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${document.title}-pages.pdf"`,
        },
      });
    }

    // Default: full PDF
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${document.title}${document.signedPdfPath ? '-signed' : ''}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
