import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, generateSignerToken } from '@/lib/auth';

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { signers: signerData, fieldAssignments, ccRecipients, expiresAt, templateId } = await req.json();

    if (!signerData || signerData.length === 0) {
      return NextResponse.json({ error: 'At least one signer is required' }, { status: 400 });
    }
    if (!fieldAssignments || fieldAssignments.length === 0) {
      return NextResponse.json({ error: 'Assign at least one field to a signer before sending' }, { status: 400 });
    }

    const document = await db.document.findFirst({
      where: { id, ownerId: payload.userId as string },
    });
    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    if (document.status !== 'Draft') {
      return NextResponse.json({ error: `Document is ${document.status}, cannot send` }, { status: 400 });
    }

    // Update document with expiry, template
    await db.document.update({
      where: { id },
      data: {
        status: 'Sent',
        ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
        ...(templateId ? { templateId } : {}),
      },
    });

    // Create signers
    const signerIdMap: Record<string, string> = {};
    for (let i = 0; i < signerData.length; i++) {
      const s = signerData[i];
      const signer = await db.signer.create({
        data: {
          email: s.email,
          name: s.name,
          order: i + 1,
          token: generateSignerToken(),
          documentId: id,
        },
      });
      signerIdMap[`temp-${i}`] = signer.id;
    }

    // Update field assignments
    for (const assignment of fieldAssignments) {
      const { fieldId, signerIndex } = assignment;
      const realSignerId = signerIdMap[`temp-${signerIndex}`];
      if (realSignerId) {
        await db.documentField.update({ where: { id: fieldId }, data: { signerId: realSignerId } });
      }
    }

    // Create CC recipients
    if (ccRecipients && ccRecipients.length > 0) {
      for (const cc of ccRecipients) {
        await db.ccRecipient.create({
          data: { email: cc.email, name: cc.name, documentId: id },
        });
      }
    }

    await db.auditLog.create({
      data: {
        action: 'DOCUMENT_SENT',
        documentId: id,
        userId: payload.userId as string,
        details: `Document sent to ${signerData.map((s: { email: string }) => s.email).join(', ')}${expiresAt ? `. Expires: ${expiresAt}` : ''}${ccRecipients?.length ? `. CC: ${ccRecipients.map((c: { email: string }) => c.email).join(', ')}` : ''}`,
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || null,
      },
    });

    const updated = await db.document.findFirst({
      where: { id },
      include: {
        signers: { orderBy: { order: 'asc' } },
        fields: { orderBy: { pageNumber: 'asc' } },
        ccRecipients: true,
      },
    });

    return NextResponse.json({
      id: updated!.id,
      title: updated!.title,
      status: updated!.status,
      createdAt: updated!.createdAt,
      expiresAt: updated!.expiresAt,
      signedPdfPath: updated!.signedPdfPath,
      ownerId: updated!.ownerId,
      signers: updated!.signers.map((s) => ({
        id: s.id, email: s.email, name: s.name, order: s.order,
        signedAt: s.signedAt, rejectedAt: s.rejectedAt, rejectionReason: s.rejectionReason, token: s.token,
      })),
      fields: updated!.fields.map((f) => ({
        id: f.id, type: f.type, pageNumber: f.pageNumber,
        x: f.x, y: f.y, width: f.width, height: f.height,
        value: f.value, signerId: f.signerId,
      })),
      ccRecipients: updated!.ccRecipients.map((cc) => ({ id: cc.id, email: cc.email, name: cc.name })),
    });
  } catch (error) {
    console.error('Send document error:', error);
    return NextResponse.json({ error: 'Failed to send document' }, { status: 500 });
  }
}