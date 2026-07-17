import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import path from 'path';
import { readFile } from 'fs/promises';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

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
    const document = await db.document.findFirst({
      where: { id, ownerId: payload.userId as string },
    });

    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const pdfPath = document.signedPdfPath || document.originalPdfPath;
    const filePath = path.join(UPLOADS_DIR, pdfPath);
    const fileBuffer = await readFile(filePath);

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