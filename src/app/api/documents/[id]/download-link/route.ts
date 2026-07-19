import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomBytes } from 'crypto';
import { getAuthUser } from '@/lib/permissions'


// POST /api/documents/[id]/download-link - Create time-limited download link
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { type } = await req.json();

    if (!['signed_pdf', 'certificate'].includes(type)) {
      return NextResponse.json({ error: 'Type must be signed_pdf or certificate' }, { status: 400 });
    }

    const doc = await db.document.findFirst({
      where: { id, ownerId: payload.userId as string },
    });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    if (type === 'signed_pdf' && !doc.signedPdfPath) {
      return NextResponse.json({ error: 'No signed PDF available' }, { status: 400 });
    }
    if (type === 'certificate' && !doc.certificatePath) {
      return NextResponse.json({ error: 'No certificate available' }, { status: 400 });
    }

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await db.downloadLink.create({
      data: {
        token,
        documentId: id,
        type,
        expiresAt,
      },
    });

    return NextResponse.json({
      url: `/api/documents/download/${token}`,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Create download link error:', error);
    return NextResponse.json({ error: 'Failed to create download link' }, { status: 500 });
  }
}
