import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { reason } = await req.json();

    if (!reason) return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });

    const signer = await db.signer.findUnique({
      where: { token },
      include: { document: true },
    });

    if (!signer) return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
    if (signer.signedAt || signer.rejectedAt) {
      return NextResponse.json({ error: 'Already responded' }, { status: 400 });
    }

    await db.signer.update({
      where: { id: signer.id },
      data: { rejectedAt: new Date(), rejectionReason: reason },
    });

    await db.document.update({
      where: { id: signer.documentId },
      data: { status: 'Rejected' },
    });

    await db.auditLog.create({
      data: {
        action: 'SIGNER_REJECTED',
        documentId: signer.documentId,
        signerId: signer.id,
        details: `${signer.name} rejected: ${reason}`,
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reject error:', error);
    return NextResponse.json({ error: 'Failed to reject' }, { status: 500 });
  }
}