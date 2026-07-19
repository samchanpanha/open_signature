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

    if (isS3Configured()) {
      const signedUrl = await getSignedDownloadUrl(document.originalPdfPath, 3600);
      return NextResponse.redirect(signedUrl);
    }

    const fileBuffer = await readPdfStorage(document.originalPdfPath);

    return new NextResponse(fileBuffer as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('File serve error:', error);
    return NextResponse.json({ error: 'Failed to load file' }, { status: 500 });
  }
}