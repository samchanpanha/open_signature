import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, getUserRole, hasPermission } from '@/lib/permissions'


async function checkAccess(userId: string, documentId: string) {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    select: { ownerId: true, organizationId: true },
  });
  if (!doc) return null;

  if (doc.ownerId === userId) return doc;
  if (!doc.organizationId) return null;

  const role = await getUserRole(userId, doc.organizationId);
  if (!role) return null;
  if (role === 'owner' || role === 'admin') return doc;

  const canUpdate = await hasPermission(userId, doc.organizationId, 'document', 'update');
  return canUpdate ? doc : null;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const userId = payload.userId as string;
    const { title } = await req.json();
    if (!title || !title.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const doc = await checkAccess(userId, id);
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const updated = await db.document.update({
      where: { id },
      data: { title: title.trim() },
    });

    return NextResponse.json({ id: updated.id, title: updated.title });
  } catch (error) {
    console.error('Rename error:', error);
    return NextResponse.json({ error: 'Failed to rename' }, { status: 500 });
  }
}
