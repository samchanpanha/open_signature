import crypto from 'crypto';
import { db } from '@/lib/db';

export async function dispatchWebhook(orgId: string, event: string, payload: object): Promise<void> {
  try {
    const webhooks = await db.webhook.findMany({
      where: { isActive: true, orgId },
    });

    for (const webhook of webhooks) {
      const subscribedEvents = JSON.parse(webhook.events) as string[];
      if (!subscribedEvents.includes(event) && !subscribedEvents.includes('*')) continue;

      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      const eventRecord = await db.webhookEvent.create({
        data: {
          webhookId: webhook.id,
          event,
          payload: JSON.stringify(payload),
          status: 'pending',
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
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          await db.webhookEvent.update({
            where: { id: eventRecord.id },
            data: { status: 'sent', sentAt: new Date(), attempts: 1 },
          });
        } else {
          await db.webhookEvent.update({
            where: { id: eventRecord.id },
            data: { status: 'failed', lastError: `HTTP ${response.status}`, attempts: 1 },
          });
        }
      } catch (err) {
        await db.webhookEvent.update({
          where: { id: eventRecord.id },
          data: {
            status: 'failed',
            lastError: err instanceof Error ? err.message : 'Unknown error',
            attempts: 1,
          },
        });
      }
    }
  } catch (err) {
    console.error('Webhook dispatch error:', err);
  }
}

export async function triggerWebhooks(userId: string, event: string, payload: Record<string, any>) {
  try {
    const webhooks = await db.webhook.findMany({
      where: { createdBy: userId, isActive: true, events: { contains: event } },
    });

    for (const webhook of webhooks) {
      try {
        const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
        const signature = webhook.secret
          ? crypto.createHmac('sha256', webhook.secret).update(body).digest('hex')
          : undefined;

        await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(signature && { 'X-Webhook-Signature': signature }),
          },
          body,
          signal: AbortSignal.timeout(10000),
        });
      } catch {
        // Don't throw on webhook failure
      }
    }
  } catch {
    // Ignore
  }
}
