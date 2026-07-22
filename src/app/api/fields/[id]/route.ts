import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, hasPermission } from '@/lib/permissions'

async function canEditDocument(userId: string, documentId: string): Promise<boolean> {
  const doc = await db.document.findFirst({ where: { id: documentId } });
  if (!doc) return false;
  if (doc.ownerId === userId) return true;
  if (doc.organizationId) {
    const allowed = await hasPermission(userId, doc.organizationId, 'document', 'update');
    if (allowed) return true;
  }
  return false;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const field = await db.documentField.findFirst({ where: { id } });
    if (!field) return NextResponse.json({ error: 'Field not found' }, { status: 404 });

    const allowed = await canEditDocument(payload.userId as string, field.documentId);
    if (!allowed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let signerIdUpdate = {};
    if (body.signerId !== undefined) {
      if (body.signerId) {
        const signerExists = await db.signer.findFirst({
          where: { id: body.signerId, documentId: field.documentId },
        });
        if (!signerExists) {
          return NextResponse.json({ error: 'Signer not found for this document' }, { status: 400 });
        }
        signerIdUpdate = { signerId: body.signerId };
      } else {
        signerIdUpdate = { signerId: null };
      }
    }

    const updated = await db.documentField.update({
      where: { id },
      data: {
        ...signerIdUpdate,
        ...(body.value !== undefined ? { value: body.value } : {}),
        ...(body.x !== undefined ? { x: body.x } : {}),
        ...(body.y !== undefined ? { y: body.y } : {}),
        ...(body.width !== undefined ? { width: body.width } : {}),
        ...(body.height !== undefined ? { height: body.height } : {}),
        ...(body.label !== undefined ? { label: body.label || null } : {}),
        ...(body.required !== undefined ? { required: body.required } : {}),
        ...(body.options !== undefined ? { options: body.options ? JSON.stringify(body.options) : null } : {}),
      },
    });

    return NextResponse.json({
      id: updated.id,
      type: updated.type,
      label: updated.label,
      required: updated.required,
      options: updated.options ? JSON.parse(updated.options) : null,
      pageNumber: updated.pageNumber,
      x: updated.x,
      y: updated.y,
      width: updated.width,
      height: updated.height,
      value: updated.value,
      signerId: updated.signerId,
    });
  } catch (error) {
    console.error('Update field error:', error);
    return NextResponse.json({ error: 'Failed to update field' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const field = await db.documentField.findFirst({ where: { id } });
    if (!field) return NextResponse.json({ error: 'Field not found' }, { status: 404 });

    const allowed = await canEditDocument(payload.userId as string, field.documentId);
    if (!allowed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await db.documentField.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete field error:', error);
    return NextResponse.json({ error: 'Failed to delete field' }, { status: 500 });
  }
}