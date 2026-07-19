import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readPdfStorage, isS3Configured, getSignedDownloadUrl } from '@/lib/s3';

// GET /api/documents/download/[token] - Download file by time-limited token
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;

    const link = await db.downloadLink.findUnique({
      where: { token },
      include: { document: true },
    });

    if (!link) {
      return NextResponse.json({ error: 'Invalid download link' }, { status: 404 });
    }

    if (new Date() > link.expiresAt) {
      await db.downloadLink.delete({ where: { id: link.id } });
      return NextResponse.json({ error: 'Download link has expired' }, { status: 410 });
    }

    const doc = link.document;
    let storageKey: string;
    let fileName: string;

    if (link.type === 'signed_pdf') {
      if (!doc.signedPdfPath) {
        return NextResponse.json({ error: 'Signed PDF not available' }, { status: 404 });
      }
      fileName = `${doc.title}-signed.pdf`;
      storageKey = doc.signedPdfPath;
    } else {
      if (!doc.certificatePath) {
        return NextResponse.json({ error: 'Certificate not available' }, { status: 404 });
      }
      fileName = `${doc.title}-certificate.pdf`;
      storageKey = doc.certificatePath;
    }

    if (isS3Configured()) {
      const signedUrl = await getSignedDownloadUrl(storageKey, 900);
      await db.downloadLink.delete({ where: { id: link.id } });
      return NextResponse.redirect(signedUrl);
    }

    const fileBuffer = await readPdfStorage(storageKey);
    await db.downloadLink.delete({ where: { id: link.id } });

    return new NextResponse(fileBuffer as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Download by token error:', error);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
