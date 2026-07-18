import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, getUserRole } from '@/lib/permissions';
import crypto from 'crypto';

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

    const webhooks = await db.webhook.findMany({
      where: { orgId },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        events_log: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ webhooks });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhooks' },
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
    const { url, events, orgId } = body;

    if (!url || !events || !orgId) {
      return NextResponse.json(
        { error: 'URL, events, and organization ID are required' },
        { status: 400 }
      );
    }

    const role = await getUserRole(user.userId, orgId);
    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = await db.webhook.create({
      data: {
        url,
        secret,
        events: JSON.stringify(events),
        orgId,
        createdBy: user.userId,
      },
    });

    return NextResponse.json({ webhook }, { status: 201 });
  } catch (error) {
    console.error('Error creating webhook:', error);
    return NextResponse.json(
      { error: 'Failed to create webhook' },
      { status: 500 }
    );
  }
}
