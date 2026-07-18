import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { getAlertEngine } from '@/lib/alerts/alert-engine';
import { dispatchWebhook } from '@/lib/webhooks';

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

// POST /api/documents/[id]/revoke - Owner revokes an in-progress document
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { reason } = await req.json();

    const doc = await db.document.findFirst({
      where: { id, ownerId: payload.userId as string },
      include: { signers: true, organization: true },
    });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    if (!['Sent', 'Signing'].includes(doc.status)) {
      return NextResponse.json({ error: 'Can only revoke documents that are Sent or Signing' }, { status: 400 });
    }

    const now = new Date();

    // Update document
    await db.document.update({
      where: { id },
      data: {
        status: 'Revoked',
        revokedAt: now,
        revokedBy: payload.userId as string,
        revokeReason: reason || 'Revoked by owner',
      },
    });

    // Audit log
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    await db.auditLog.create({
      data: {
        action: 'DOCUMENT_REVOKED',
        documentId: id,
        details: `Document revoked by owner. Reason: ${reason || 'Revoked by owner'}. Affected signers: ${doc.signers.map(s => s.email).join(', ')}`,
        ipAddress: ip,
        userAgent: req.headers.get('user-agent') || 'unknown',
      },
    });

    // Notify all signers
    const alertEngine = getAlertEngine();
    for (const signer of doc.signers) {
      if (!signer.signedAt && !signer.rejectedAt) {
        await alertEngine.notifyDocumentOwner(
          payload.userId as string,
          doc.title,
          doc.id,
          'revoked'
        );
      }
    }

    // Dispatch webhook
    if (doc.organizationId) {
      dispatchWebhook(doc.organizationId, 'document.revoked', {
        documentId: id,
        title: doc.title,
        reason: reason || 'Revoked by owner',
        revokedAt: now.toISOString(),
      });
    }

    return NextResponse.json({ success: true, message: 'Document revoked' });
  } catch (error) {
    console.error('Revoke document error:', error);
    return NextResponse.json({ error: 'Failed to revoke document' }, { status: 500 });
  }
}
