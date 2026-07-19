import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';
import { randomBytes } from 'crypto';

// POST - Create share link
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const userId = payload.userId as string;
    const { expiresInDays, viewOnly } = await req.json().catch(() => ({}));

    const document = await db.document.findFirst({
      where: { id, ownerId: userId },
    });
    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const token = randomBytes(24).toString('hex');
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000)
      : null;

    const shareLink = await db.shareLink.create({
      data: {
        documentId: id,
        token,
        expiresAt,
        viewOnly: viewOnly !== false,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    return NextResponse.json({
      link: shareLink,
      url: `${baseUrl}/share/${token}`,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }
}

// GET - List share links for a document
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const links = await db.shareLink.findMany({
      where: { documentId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ links });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get share links' }, { status: 500 });
  }
}

// DELETE - Revoke a share link
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { linkId } = await req.json();

    await db.shareLink.deleteMany({
      where: { id: linkId, documentId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to revoke share link' }, { status: 500 });
  }
}
