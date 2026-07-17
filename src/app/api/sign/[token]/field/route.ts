import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { fieldId, value } = await req.json();

    const signer = await db.signer.findUnique({ where: { token } });
    if (!signer) return NextResponse.json({ error: 'Invalid signing link' }, { status: 404 });
    if (signer.signedAt) return NextResponse.json({ error: 'Already signed' }, { status: 400 });

    const field = await db.documentField.findFirst({
      where: { id: fieldId, signerId: signer.id },
    });
    if (!field) return NextResponse.json({ error: 'Field not found or not assigned to you' }, { status: 404 });

    await db.documentField.update({
      where: { id: fieldId },
      data: { value },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update field error:', error);
    return NextResponse.json({ error: 'Failed to update field' }, { status: 500 });
  }
}