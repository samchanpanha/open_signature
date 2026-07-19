import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions'


export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const field = await db.documentField.findFirst({ where: { id } });
    if (!field) return NextResponse.json({ error: 'Field not found' }, { status: 404 });

    const doc = await db.document.findFirst({
      where: { id: field.documentId, ownerId: payload.userId as string },
    });
    if (!doc) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const updated = await db.documentField.update({
      where: { id },
      data: {
        ...(body.signerId !== undefined ? { signerId: body.signerId || null } : {}),
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

    const doc = await db.document.findFirst({
      where: { id: field.documentId, ownerId: payload.userId as string },
    });
    if (!doc) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await db.documentField.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete field error:', error);
    return NextResponse.json({ error: 'Failed to delete field' }, { status: 500 });
  }
}