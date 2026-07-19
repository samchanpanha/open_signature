import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = payload.userId || payload.id;
    const webhooks = await db.webhook.findMany({
      where: { createdBy: userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ webhooks });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get webhooks' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = payload.userId || payload.id;
    const { url, events, secret } = await req.json();

    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 });

    try { new URL(url); } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const webhook = await db.webhook.create({
      data: {
        url,
        events: JSON.stringify(events ? events.split(',') : ['document.completed', 'document.sent']),
        secret: secret || crypto.randomBytes(32).toString('hex'),
        createdBy: userId,
        orgId: '',
      },
    });

    return NextResponse.json({ webhook });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { webhookId } = await req.json();
    await db.webhook.delete({ where: { id: webhookId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
  }
}
