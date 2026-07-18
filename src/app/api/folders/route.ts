import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, getUserRole } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const role = await getUserRole(user.userId, orgId);
    if (!role) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const folders = await db.folder.findMany({
      where: { orgId },
      include: {
        children: {
          orderBy: { name: 'asc' },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ folders });
  } catch (error) {
    console.error('Error fetching folders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch folders' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, parentId, orgId } = body;

    if (!name || !orgId) {
      return NextResponse.json(
        { error: 'Name and organization ID are required' },
        { status: 400 }
      );
    }

    const role = await getUserRole(user.userId, orgId);
    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (parentId) {
      const parentFolder = await db.folder.findUnique({
        where: { id: parentId },
      });

      if (!parentFolder || parentFolder.orgId !== orgId) {
        return NextResponse.json(
          { error: 'Parent folder not found' },
          { status: 404 }
        );
      }
    }

    const folder = await db.folder.create({
      data: {
        name,
        parentId: parentId || null,
        orgId,
        createdBy: user.userId,
      },
    });

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    console.error('Error creating folder:', error);
    return NextResponse.json(
      { error: 'Failed to create folder' },
      { status: 500 }
    );
  }
}
