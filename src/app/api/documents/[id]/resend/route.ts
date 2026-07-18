import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { getAlertEngine } from '@/lib/alerts/alert-engine';

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
    const { signerIds } = await req.json();

    const document = await db.document.findFirst({
      where: { id, ownerId: payload.userId as string },
      include: { signers: true },
    });
    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    if (document.status !== 'Sent' && document.status !== 'Signing') {
      return NextResponse.json({ error: 'Can only resend for Sent or Signing documents' }, { status: 400 });
    }

    const alertEngine = getAlertEngine();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const targetSigners = signerIds?.length
      ? document.signers.filter(s => signerIds.includes(s.id) && !s.signedAt && !s.rejectedAt)
      : document.signers.filter(s => !s.signedAt && !s.rejectedAt);

    let resent = 0;
    for (const signer of targetSigners) {
      try {
        await alertEngine.sendEmail({
          from: process.env.EMAIL_FROM || 'noreply@opsign.com',
          to: signer.email,
          subject: `Sign: ${document.title} — Resent`,
          html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#1a1a2e;">Signing Reminder</h2>
  <p>Hello ${signer.name || signer.email},</p>
  <p>This is a reminder that the document <strong>"${document.title}"</strong> is still awaiting your signature.</p>
  <div style="text-align:center;margin:30px 0;">
    <a href="${baseUrl}/?sign=${signer.token}" style="background:#6366f1;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">
      Review &amp; Sign
    </a>
  </div>
</body></html>`,
        });
        resent++;
      } catch (err) {
        console.error(`Failed to resend to ${signer.email}:`, err);
      }
    }

    await db.auditLog.create({
      data: {
        action: 'SIGNING_LINK_RESENT',
        documentId: id,
        userId: payload.userId as string,
        details: `Resent signing links to ${resent} signer(s): ${targetSigners.map(s => s.email).join(', ')}`,
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      },
    });

    return NextResponse.json({ success: true, resent });
  } catch (error) {
    console.error('Resend error:', error);
    return NextResponse.json({ error: 'Failed to resend' }, { status: 500 });
  }
}
