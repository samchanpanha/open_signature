import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

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
      },
    });

    return NextResponse.json({
      id: updated.id,
      type: updated.type,
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