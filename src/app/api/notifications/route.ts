import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';

// GET /api/notifications - List user notifications
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = { userId: user.id };
    
    if (unreadOnly) {
      where.read = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      include: {
        document: { 
          select: { 
            id: true, 
            title: true,
            status: true,
          } 
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: user.id, read: false },
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

// PUT /api/notifications/[id] - Mark notification as read
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, read } = body;

    if (!id) {
      return NextResponse.json({ error: 'Notification ID required' }, { status: 400 });
    }

    // Verify ownership
    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== user.id) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: read !== undefined ? read : true },
    });

    return NextResponse.json({ notification: updated });
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications - Clear notifications
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const all = searchParams.get('all') === 'true';

    if (all) {
      await prisma.notification.deleteMany({
        where: { userId: user.id },
      });
    } else {
      // Delete only read notifications
      await prisma.notification.deleteMany({
        where: { userId: user.id, read: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting notifications:', error);
    return NextResponse.json(
      { error: 'Failed to delete notifications' },
      { status: 500 }
    );
  }
}
