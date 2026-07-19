import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateSignerToken } from '@/lib/auth'
import { getAlertEngine } from '@/lib/alerts/alert-engine';
import { dispatchWebhook } from '@/lib/webhooks';
import { getAuthUser } from '@/lib/permissions'


// POST /api/documents/bulk-send - Send same document to multiple recipient groups
export async function POST(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { documentId, recipients, message, expiresInDays } = await req.json();

    if (!documentId) return NextResponse.json({ error: 'documentId required' }, { status: 400 });
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'recipients array required' }, { status: 400 });
    }

    // Verify document ownership and status
    const doc = await db.document.findFirst({
      where: { id: documentId, ownerId: payload.userId as string },
      include: { fields: true, signers: true },
    });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    if (doc.status !== 'Draft') {
      return NextResponse.json({ error: 'Can only bulk-send documents in Draft status' }, { status: 400 });
    }
    if (doc.fields.length === 0) {
      return NextResponse.json({ error: 'Document must have at least one field' }, { status: 400 });
    }

    const alertEngine = getAlertEngine();
    const results: { recipientGroup: number; signerTokens: string[]; documentId: string }[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const group = recipients[i];
      if (!group.email) continue;

      // Create a new document for each recipient (clone)
      const newDoc = await db.document.create({
        data: {
          title: `${doc.title} - ${group.name || group.email}`,
          originalPdfPath: doc.originalPdfPath,
          status: 'Sent',
          ownerId: doc.ownerId,
          expiresAt: expiresInDays
            ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
            : null,
          organizationId: doc.organizationId,
          folderId: doc.folderId,
          allowOfflineSign: doc.allowOfflineSign,
        },
      });

      // Clone fields
      for (const field of doc.fields) {
        await db.documentField.create({
          data: {
            documentId: newDoc.id,
            type: field.type,
            label: field.label,
            required: field.required,
            pageNumber: field.pageNumber,
            x: field.x,
            y: field.y,
            width: field.width,
            height: field.height,
          },
        });
      }

      // Create signer
      const signerToken = generateSignerToken();
      const signer = await db.signer.create({
        data: {
          documentId: newDoc.id,
          email: group.email,
          name: group.name || group.email,
          order: 1,
          role: group.role || 'signer',
          token: signerToken,
        },
      });

      // Auto-assign fields to signer
      const newFields = await db.documentField.findMany({ where: { documentId: newDoc.id } });
      for (const field of newFields) {
        await db.documentField.update({
          where: { id: field.id },
          data: { signerId: signer.id },
        });
      }

      // Audit log
      await db.auditLog.create({
        data: {
          action: 'DOCUMENT_BULK_SENT',
          documentId: newDoc.id,
          details: `Bulk send: Document sent to ${group.email} (${group.name || 'unnamed'})`,
          ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
          userAgent: req.headers.get('user-agent') || 'unknown',
        },
      });

      // Send notification
      await alertEngine.notifyDocumentOwner(
        payload.userId as string,
        newDoc.title,
        newDoc.id,
        'sent',
        doc.organizationId ?? undefined
      );

      results.push({
        recipientGroup: i + 1,
        signerTokens: [signerToken],
        documentId: newDoc.id,
      });
    }

    // Dispatch webhook for bulk send
    if (doc.organizationId) {
      dispatchWebhook(doc.organizationId, 'document.bulk_sent', {
        originalDocumentId: documentId,
        totalRecipients: recipients.length,
        results,
        sentAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      totalSent: results.length,
      results,
    });
  } catch (error) {
    console.error('Bulk send error:', error);
    return NextResponse.json({ error: 'Failed to bulk send' }, { status: 500 });
  }
}
