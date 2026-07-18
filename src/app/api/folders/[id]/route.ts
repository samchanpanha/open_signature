import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, getUserRole } from '@/lib/permissions';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.folder.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    const role = await getUserRole(user.userId, existing.orgId);
    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name } = body;

    const updated = await db.folder.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
      },
    });

    return NextResponse.json({ folder: updated });
  } catch (error) {
    console.error('Error updating folder:', error);
    return NextResponse.json(
      { error: 'Failed to update folder' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.folder.findUnique({
      where: { id },
      include: { children: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    const role = await getUserRole(user.userId, existing.orgId);
    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (existing.children.length > 0) {
      await db.folder.updateMany({
        where: { parentId: id },
        data: { parentId: existing.parentId },
      });
    }

    await db.folder.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting folder:', error);
    return NextResponse.json(
      { error: 'Failed to delete folder' },
      { status: 500 }
    );
  }
}
