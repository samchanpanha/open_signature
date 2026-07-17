import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import path from 'path';
import { readFile } from 'fs/promises';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;

    const signer = await db.signer.findUnique({
      where: { token },
      include: { document: true },
    });

    if (!signer) return NextResponse.json({ error: 'Invalid signing link' }, { status: 404 });

    const filePath = path.join(UPLOADS_DIR, signer.document.originalPdfPath);
    const fileBuffer = await readFile(filePath);

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