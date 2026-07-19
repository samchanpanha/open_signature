import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';
import { copyPdfStorage } from '@/lib/s3';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const document = await db.document.findFirst({
      where: { id, ownerId: payload.userId as string },
    });
    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const versions = await db.documentVersion.findMany({
      where: { documentId: id },
      orderBy: { version: 'desc' },
    });

    return NextResponse.json({ versions });
  } catch (error) {
    console.error('Get versions error:', error);
    return NextResponse.json({ error: 'Failed to get versions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const userId = payload.userId as string;
    const { changeNote } = await req.json().catch(() => ({}));

    const document = await db.document.findFirst({
      where: { id, ownerId: userId },
    });
    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const lastVersion = await db.documentVersion.findFirst({
      where: { documentId: id },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (lastVersion?.version || 0) + 1;

    const currentPdf = document.signedPdfPath || document.originalPdfPath;
    const versionPath = `versions/${id}/v${nextVersion}-${randomUUID()}.pdf`;
    await copyPdfStorage(currentPdf, versionPath);

    const version = await db.documentVersion.create({
      data: {
        documentId: id,
        version: nextVersion,
        pdfPath: versionPath,
        title: document.title,
        changedBy: userId,
        changeNote: changeNote || null,
      },
    });

    return NextResponse.json({ version });
  } catch (error) {
    console.error('Create version error:', error);
    return NextResponse.json({ error: 'Failed to create version' }, { status: 500 });
  }
}
