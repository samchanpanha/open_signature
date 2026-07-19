import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';

// GET - List comments for a document
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const pageNumber = searchParams.get('page');

    const where: any = { documentId: id };
    if (pageNumber) where.pageNumber = parseInt(pageNumber);

    const comments = await db.documentComment.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get comments' }, { status: 500 });
  }
}

// POST - Add a comment
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const userId = payload.userId as string;
    const { content, pageNumber, x, y } = await req.json();

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Comment content required' }, { status: 400 });
    }

    const comment = await db.documentComment.create({
      data: {
        documentId: id,
        userId,
        content: content.trim().slice(0, 2000),
        pageNumber: pageNumber || null,
        x: x || null,
        y: y || null,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({ comment });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
  }
}

// PATCH - Resolve/unresolve a comment
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { commentId, resolved } = await req.json();

    const comment = await db.documentComment.update({
      where: { id: commentId, documentId: id },
      data: { resolved: !!resolved },
    });

    return NextResponse.json({ comment });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
  }
}

// DELETE - Delete a comment
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { commentId } = await req.json();

    await db.documentComment.deleteMany({
      where: { id: commentId, documentId: id, userId: payload.userId as string },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}