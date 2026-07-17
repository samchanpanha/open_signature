import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

export async function POST(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { documentId, type, pageNumber, x, y, width, height, signerId } = await req.json();

    // Verify document ownership
    const doc = await db.document.findFirst({
      where: { id: documentId, ownerId: payload.userId as string },
    });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    if (doc.status !== 'Draft') {
      return NextResponse.json({ error: 'Can only edit fields in Draft status' }, { status: 400 });
    }

    const field = await db.documentField.create({
      data: { documentId, type, pageNumber, x, y, width, height, signerId: signerId || null },
    });

    return NextResponse.json({
      id: field.id,
      type: field.type,
      pageNumber: field.pageNumber,
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height,
      value: field.value,
      signerId: field.signerId,
    });
  } catch (error) {
    console.error('Create field error:', error);
    return NextResponse.json({ error: 'Failed to create field' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const fieldId = searchParams.get('id');
    if (!fieldId) return NextResponse.json({ error: 'Field ID required' }, { status: 400 });

    const field = await db.documentField.findFirst({ where: { id: fieldId } });
    if (!field) return NextResponse.json({ error: 'Field not found' }, { status: 404 });

    // Verify document ownership
    const doc = await db.document.findFirst({
      where: { id: field.documentId, ownerId: payload.userId as string },
    });
    if (!doc) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (doc.status !== 'Draft') {
      return NextResponse.json({ error: 'Can only edit fields in Draft status' }, { status: 400 });
    }

    await db.documentField.delete({ where: { id: fieldId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete field error:', error);
    return NextResponse.json({ error: 'Failed to delete field' }, { status: 500 });
  }
}