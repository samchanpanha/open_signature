import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { fieldId, value } = await req.json();

    const signer = await db.signer.findUnique({
      where: { token },
      include: { document: { select: { id: true, status: true } } },
    });
    if (!signer) return NextResponse.json({ error: 'Invalid signing link' }, { status: 404 });
    if (signer.signedAt) return NextResponse.json({ error: 'Already signed' }, { status: 400 });
    if (signer.document.status === 'Completed' || signer.document.status === 'Expired' || signer.document.status === 'Revoked') {
      return NextResponse.json({ error: 'Document is no longer available for signing' }, { status: 400 });
    }

    let field = await db.documentField.findFirst({
      where: { id: fieldId, signerId: signer.id },
    });

    if (!field) {
      field = await db.documentField.findFirst({
        where: { id: fieldId, documentId: signer.documentId },
      });
    }

    if (!field) return NextResponse.json({ error: 'Field not found' }, { status: 404 });

    if (!field.signerId || field.signerId !== signer.id) {
      await db.documentField.update({
        where: { id: fieldId },
        data: { signerId: signer.id },
      });
    }

    await db.documentField.update({
      where: { id: fieldId },
      data: { value },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update signing field error:', error);
    return NextResponse.json({ error: 'Failed to update field' }, { status: 500 });
  }
}
