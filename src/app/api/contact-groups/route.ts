import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';

// GET - List contact groups
export async function GET(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const groups = await db.contactGroup.findMany({
      where: { userId: payload.userId as string },
      include: {
        contacts: {
          include: { contact: { select: { id: true, name: true, email: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ groups });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get groups' }, { status: 500 });
  }
}

// POST - Create contact group
export async function POST(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, contactIds } = await req.json();
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Group name required' }, { status: 400 });
    }

    const group = await db.contactGroup.create({
      data: {
        name: name.trim().slice(0, 100),
        userId: payload.userId as string,
        contacts: contactIds?.length ? {
          create: contactIds.map((id: string) => ({ contactId: id })),
        } : undefined,
      },
      include: {
        contacts: {
          include: { contact: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    return NextResponse.json({ group });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Group name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}

// PUT - Update group members
export async function PUT(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { groupId, contactIds } = await req.json();

    // Verify ownership
    const group = await db.contactGroup.findFirst({
      where: { id: groupId, userId: payload.userId as string },
    });
    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

    // Replace members
    await db.contactGroupMember.deleteMany({ where: { groupId } });
    if (contactIds?.length) {
      await db.contactGroupMember.createMany({
        data: contactIds.map((contactId: string) => ({ groupId, contactId })),
      });
    }

    const updated = await db.contactGroup.findUnique({
      where: { id: groupId },
      include: {
        contacts: {
          include: { contact: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    return NextResponse.json({ group: updated });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
  }
}

// DELETE - Delete group
export async function DELETE(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { groupId } = await req.json();

    await db.contactGroup.deleteMany({
      where: { id: groupId, userId: payload.userId as string },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}
