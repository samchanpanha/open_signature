import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';
import { readPdfStorage } from '@/lib/s3';
import { PDFDocument } from 'pdf-lib';

export async function POST(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { documentIds } = await req.json();
    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: 'Document IDs required' }, { status: 400 });
    }

    const documents = await db.document.findMany({
      where: {
        id: { in: documentIds },
        OR: [
          { ownerId: payload.userId as string },
          { organization: { members: { some: { userId: payload.userId as string } } } },
        ],
      },
    });

    if (documents.length === 0) {
      return NextResponse.json({ error: 'No accessible documents found' }, { status: 404 });
    }

    // Merge all PDFs into one
    const mergedPdf = await PDFDocument.create();
    for (const doc of documents) {
      try {
        const pdfPath = doc.signedPdfPath || doc.originalPdfPath;
        const pdfBytes = await readPdfStorage(pdfPath);
        const srcDoc = await PDFDocument.load(pdfBytes);
        const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
        copiedPages.forEach(page => mergedPdf.addPage(page));
      } catch (err) {
        console.error(`Failed to include document ${doc.id}:`, err);
      }
    }

    const mergedBytes = await mergedPdf.save();
    return new NextResponse(Buffer.from(mergedBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="documents-merged.pdf"`,
      },
    });
  } catch (error) {
    console.error('Batch export error:', error);
    return NextResponse.json({ error: 'Batch export failed' }, { status: 500 });
  }
}
