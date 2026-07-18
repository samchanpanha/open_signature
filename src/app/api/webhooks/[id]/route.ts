import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, getUserRole } from '@/lib/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const webhook = await db.webhook.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        events_log: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const role = await getUserRole(user.userId, webhook.orgId);
    if (!role) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ webhook });
  } catch (error) {
    console.error('Error fetching webhook:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook' },
      { status: 500 }
    );
  }
}

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

    const existing = await db.webhook.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const role = await getUserRole(user.userId, existing.orgId);
    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { url, events, isActive } = body;

    const updated = await db.webhook.update({
      where: { id },
      data: {
        url: url !== undefined ? url : undefined,
        events: events !== undefined ? JSON.stringify(events) : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    return NextResponse.json({ webhook: updated });
  } catch (error) {
    console.error('Error updating webhook:', error);
    return NextResponse.json(
      { error: 'Failed to update webhook' },
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

    const existing = await db.webhook.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const role = await getUserRole(user.userId, existing.orgId);
    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.webhook.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhook' },
      { status: 500 }
    );
  }
}
