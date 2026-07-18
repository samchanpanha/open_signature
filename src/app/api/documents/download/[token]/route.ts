import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readFile } from 'fs/promises';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

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
      // Clean up expired link
      await db.downloadLink.delete({ where: { id: link.id } });
      return NextResponse.json({ error: 'Download link has expired' }, { status: 410 });
    }

    const doc = link.document;
    let fileName: string;
    let filePath: string;

    if (link.type === 'signed_pdf') {
      if (!doc.signedPdfPath) {
        return NextResponse.json({ error: 'Signed PDF not available' }, { status: 404 });
      }
      fileName = `${doc.title}-signed.pdf`;
      filePath = path.join(UPLOADS_DIR, doc.signedPdfPath);
    } else {
      if (!doc.certificatePath) {
        return NextResponse.json({ error: 'Certificate not available' }, { status: 404 });
      }
      fileName = `${doc.title}-certificate.pdf`;
      filePath = path.join(UPLOADS_DIR, doc.certificatePath);
    }

    const fileBuffer = await readFile(filePath);

    // Delete the link (single-use)
    await db.downloadLink.delete({ where: { id: link.id } });

    return new NextResponse(fileBuffer, {
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
