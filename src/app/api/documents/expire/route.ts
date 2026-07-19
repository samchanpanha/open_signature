import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAlertEngine } from '@/lib/alerts/alert-engine';
import { dispatchWebhook } from '@/lib/webhooks';

// GET /api/documents/expire - Auto-expire overdue documents (call via cron or on access)
export async function GET(req: NextRequest) {
  try {
    // Optional: protect with a cron secret
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret && cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // Find documents that are past expiry and still active (Sent or Signing)
    const expiredDocs = await db.document.findMany({
      where: {
        expiresAt: { lt: now },
        status: { in: ['Sent', 'Signing'] },
      },
      include: {
        signers: true,
        organization: true,
      },
    });

    let expiredCount = 0;
    const alertEngine = getAlertEngine();

    for (const doc of expiredDocs) {
      // Mark as expired
      await db.document.update({
        where: { id: doc.id },
        data: { status: 'Expired' },
      });

      // Audit log
      await db.auditLog.create({
        data: {
          action: 'DOCUMENT_EXPIRED',
          documentId: doc.id,
          details: `Document expired on ${doc.expiresAt?.toISOString()}. Signers: ${doc.signers.map(s => s.email).join(', ')}`,
          ipAddress: 'system',
          userAgent: 'auto-expiry',
        },
      });

      // Notify document owner
      await alertEngine.notifyDocumentOwner(doc.ownerId, doc.title, doc.id, 'expired', doc.organizationId ?? undefined);

      // Dispatch webhook
      if (doc.organizationId) {
        dispatchWebhook(doc.organizationId, 'document.expired', {
          documentId: doc.id,
          title: doc.title,
          expiresAt: doc.expiresAt?.toISOString(),
          expiredAt: now.toISOString(),
        });
      }

      expiredCount++;
    }

    return NextResponse.json({
      success: true,
      expiredCount,
      checkedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Expire documents error:', error);
    return NextResponse.json({ error: 'Failed to check expired documents' }, { status: 500 });
  }
}
