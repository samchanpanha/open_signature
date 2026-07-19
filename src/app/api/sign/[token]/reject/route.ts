import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAlertEngine } from '@/lib/alerts/alert-engine';
import { dispatchWebhook } from '@/lib/webhooks';

// POST /api/sign/[token]/reject - Signer rejects document with reason
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { reason } = await req.json();

    const signer = await db.signer.findUnique({
      where: { token },
      include: { document: { include: { organization: true, owner: true, signers: true } } },
    });
    if (!signer) return NextResponse.json({ error: 'Invalid signing link' }, { status: 404 });
    if (signer.signedAt) return NextResponse.json({ error: 'Already signed' }, { status: 400 });
    if (signer.rejectedAt) return NextResponse.json({ error: 'Already rejected' }, { status: 400 });

    const now = new Date();

    // Update signer
    await db.signer.update({
      where: { id: signer.id },
      data: {
        rejectedAt: now,
        rejectionReason: reason || 'No reason provided',
      },
    });

    // Update document status
    await db.document.update({
      where: { id: signer.documentId },
      data: { status: 'Rejected' },
    });

    // Audit log
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const ua = req.headers.get('user-agent') || 'unknown';
    await db.auditLog.create({
      data: {
        action: 'DOCUMENT_REJECTED',
        documentId: signer.documentId,
        signerId: signer.id,
        details: `Document rejected by ${signer.name} (${signer.email}). Reason: ${reason || 'No reason provided'}`,
        ipAddress: ip,
        userAgent: ua,
      },
    });

    // Notify document owner
    const alertEngine = getAlertEngine();
    await alertEngine.notifyDocumentOwner(
      signer.document.ownerId,
      signer.document.title,
      signer.document.id,
      'rejected',
      signer.document.organizationId ?? undefined
    );

    // Dispatch webhook
    if (signer.document.organizationId) {
      dispatchWebhook(signer.document.organizationId, 'document.rejected', {
        documentId: signer.documentId,
        title: signer.document.title,
        rejectedBy: { name: signer.name, email: signer.email },
        reason: reason || 'No reason provided',
        rejectedAt: now.toISOString(),
      });
    }

    return NextResponse.json({ success: true, message: 'Document rejected' });
  } catch (error) {
    console.error('Reject document error:', error);
    return NextResponse.json({ error: 'Failed to reject document' }, { status: 500 });
  }
}
