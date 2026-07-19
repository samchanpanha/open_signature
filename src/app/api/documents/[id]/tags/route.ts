import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tags = await db.documentTag.findMany({ where: { documentId: id }, orderBy: { name: 'asc' } });
    return NextResponse.json({ tags });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get tags' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { name, color } = await req.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Tag name required' }, { status: 400 });
    }

    const tag = await db.documentTag.create({
      data: { documentId: id, name: name.trim().slice(0, 50), color: color || '#10b981' },
    });

    return NextResponse.json({ tag });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Tag already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to add tag' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { tagId } = await req.json();

    if (tagId) {
      await db.documentTag.deleteMany({ where: { id: tagId, documentId: id } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to remove tag' }, { status: 500 });
  }
}
