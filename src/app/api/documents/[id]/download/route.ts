import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';
import { readPdfStorage, isS3Configured, getSignedDownloadUrl } from '@/lib/s3';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const document = await db.document.findFirst({
      where: { id, ownerId: payload.userId as string },
    });

    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const pdfPath = document.signedPdfPath || document.originalPdfPath;

    if (isS3Configured()) {
      const signedUrl = await getSignedDownloadUrl(pdfPath);
      return NextResponse.redirect(signedUrl);
    }

    const fileBuffer = await readPdfStorage(pdfPath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${document.title}${document.signedPdfPath ? '-signed' : ''}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}