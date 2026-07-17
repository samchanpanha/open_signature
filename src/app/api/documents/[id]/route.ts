import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { readFile, unlink } from 'fs/promises';
import path from 'path';

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
      include: {
        signers: { orderBy: { order: 'asc' } },
        fields: { orderBy: { pageNumber: 'asc' } },
      },
    });

    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    return NextResponse.json({
      id: document.id,
      title: document.title,
      status: document.status,
      createdAt: document.createdAt,
      originalPdfPath: document.originalPdfPath,
      signedPdfPath: document.signedPdfPath,
      ownerId: document.ownerId,
      signers: document.signers.map((s) => ({
        id: s.id,
        email: s.email,
        name: s.name,
        order: s.order,
        signedAt: s.signedAt,
        token: s.token,
      })),
      fields: document.fields.map((f) => ({
        id: f.id,
        type: f.type,
        pageNumber: f.pageNumber,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        value: f.value,
        signerId: f.signerId,
      })),
    });
  } catch (error) {
    console.error('Get document error:', error);
    return NextResponse.json({ error: 'Failed to get document' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const document = await db.document.findFirst({
      where: { id, ownerId: payload.userId as string },
    });

    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // Clean up files
    try {
      await unlink(path.join(UPLOADS_DIR, document.originalPdfPath));
    } catch {}
    if (document.signedPdfPath) {
      try {
        await unlink(path.join(UPLOADS_DIR, document.signedPdfPath));
      } catch {}
    }

    await db.document.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete document error:', error);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}