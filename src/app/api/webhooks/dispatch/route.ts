import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, payload, orgId } = body;

    if (!event || !payload || !orgId) {
      return NextResponse.json(
        { error: 'Event, payload, and organization ID are required' },
        { status: 400 }
      );
    }

    const webhooks = await db.webhook.findMany({
      where: {
        orgId,
        isActive: true,
      },
    });

    const matchedWebhooks = webhooks.filter((webhook) => {
      const events: string[] = JSON.parse(webhook.events);
      return events.includes(event) || events.includes('*');
    });

    const results = await Promise.allSettled(
      matchedWebhooks.map(async (webhook) => {
        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(JSON.stringify(payload))
          .digest('hex');

        const webhookEvent = await db.webhookEvent.create({
          data: {
            webhookId: webhook.id,
            event,
            payload: JSON.stringify(payload),
            status: 'pending',
            attempts: 1,
          },
        });

        try {
          const response = await fetch(webhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Signature': signature,
              'X-Webhook-Event': event,
            },
            body: JSON.stringify({
              event,
              payload,
              timestamp: new Date().toISOString(),
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          await db.webhookEvent.update({
            where: { id: webhookEvent.id },
            data: {
              status: 'sent',
              sentAt: new Date(),
            },
          });

          return { webhookId: webhook.id, status: 'sent' };
        } catch (err) {
          await db.webhookEvent.update({
            where: { id: webhookEvent.id },
            data: {
              status: 'failed',
              lastError: err instanceof Error ? err.message : 'Unknown error',
            },
          });

          return { webhookId: webhook.id, status: 'failed', error: err instanceof Error ? err.message : 'Unknown error' };
        }
      })
    );

    return NextResponse.json({
      dispatched: matchedWebhooks.length,
      results,
    });
  } catch (error) {
    console.error('Error dispatching webhook event:', error);
    return NextResponse.json(
      { error: 'Failed to dispatch webhook event' },
      { status: 500 }
    );
  }
}
