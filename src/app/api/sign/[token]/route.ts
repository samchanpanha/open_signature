import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;

    const signer = await db.signer.findUnique({
      where: { token },
      include: { document: true },
    });

    if (!signer) {
      return NextResponse.json({ error: 'Invalid signing link' }, { status: 404 });
    }

    // Check expiry
    if (signer.document.expiresAt && new Date() > signer.document.expiresAt) {
      await db.document.update({ where: { id: signer.documentId }, data: { status: 'Expired' } });
      return NextResponse.json({ error: 'This document has expired', code: 'EXPIRED' }, { status: 400 });
    }

    if (signer.document.status === 'Completed') {
      return NextResponse.json({ error: 'Document already completed' }, { status: 400 });
    }
    if (signer.document.status === 'Rejected') {
      return NextResponse.json({ error: 'Document has been rejected', code: 'REJECTED' }, { status: 400 });
    }
    if (signer.document.status === 'Expired') {
      return NextResponse.json({ error: 'This document has expired', code: 'EXPIRED' }, { status: 400 });
    }

    if (signer.signedAt) {
      return NextResponse.json({ error: 'You have already signed this document' }, { status: 400 });
    }
    if (signer.rejectedAt) {
      return NextResponse.json({ error: 'You have already rejected this document' }, { status: 400 });
    }

    // Check signing order
    const allSigners = await db.signer.findMany({
      where: { documentId: signer.documentId },
      orderBy: { order: 'asc' },
    });

    const myIndex = allSigners.findIndex((s) => s.id === signer.id);
    for (let i = 0; i < myIndex; i++) {
      if (!allSigners[i].signedAt) {
        return NextResponse.json({ error: 'Please wait for other signers to complete first' }, { status: 400 });
      }
    }

    await db.document.update({
      where: { id: signer.documentId },
      data: { status: 'Signing' },
    });

    const signerFields = await db.documentField.findMany({
      where: { signerId: signer.id },
      orderBy: { pageNumber: 'asc' },
    });

    return NextResponse.json({
      signer: {
        id: signer.id,
        email: signer.email,
        name: signer.name,
        order: signer.order,
        signedAt: signer.signedAt,
        fields: signerFields.map((f) => ({
          id: f.id, type: f.type, pageNumber: f.pageNumber,
          x: f.x, y: f.y, width: f.width, height: f.height, value: f.value,
        })),
      },
      document: {
        id: signer.document.id,
        title: signer.document.title,
        status: signer.document.status,
        expiresAt: signer.document.expiresAt,
      },
    });
  } catch (error) {
    console.error('Sign info error:', error);
    return NextResponse.json({ error: 'Failed to get signing info' }, { status: 500 });
  }
}