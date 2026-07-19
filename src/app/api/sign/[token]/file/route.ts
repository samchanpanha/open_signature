import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readPdfStorage, isS3Configured, getSignedDownloadUrl } from '@/lib/s3';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;

    const signer = await db.signer.findUnique({
      where: { token },
      include: { document: true },
    });

    if (!signer) return NextResponse.json({ error: 'Invalid signing link' }, { status: 404 });

    if (isS3Configured()) {
      const signedUrl = await getSignedDownloadUrl(signer.document.originalPdfPath, 3600);
      return NextResponse.redirect(signedUrl);
    }

    const fileBuffer = await readPdfStorage(signer.document.originalPdfPath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Sign file error:', error);
    return NextResponse.json({ error: 'Failed to load file' }, { status: 500 });
  }
}