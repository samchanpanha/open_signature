import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, getUserRole } from '@/lib/permissions';

const defaultTemplates = [
  {
    name: 'signature_request',
    subject: 'Sign: {{documentTitle}}',
    htmlBody: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f8f9fa; border-radius: 8px; padding: 30px; text-align: center;">
    <h1 style="color: #1a1a2e; margin-bottom: 10px;">Open Signature</h1>
    <p style="color: #666; font-size: 16px;">You have been requested to sign a document</p>
  </div>
  <div style="padding: 30px 0;">
    <h2 style="color: #1a1a2e;">{{documentTitle}}</h2>
    <p style="color: #444; line-height: 1.6;">
      <strong>{{senderName}}</strong> has sent you a document to sign.
    </p>
    <p style="color: #444; line-height: 1.6;">
      Please click the button below to review and sign the document.
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{signingLink}}" style="background: #6366f1; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
        Review &amp; Sign
      </a>
    </div>
    <p style="color: #999; font-size: 13px;">
      If you are unable to click the button, copy and paste the following link into your browser:<br>
      <a href="{{signingLink}}" style="color: #6366f1;">{{signingLink}}</a>
    </p>
  </div>
  <div style="border-top: 1px solid #eee; padding-top: 20px; color: #999; font-size: 12px; text-align: center;">
    This email was sent by Open Signature. Do not share this email with others.
  </div>
</body>
</html>`,
  },
  {
    name: 'document_completed',
    subject: 'Completed: {{documentTitle}}',
    htmlBody: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f0fdf4; border-radius: 8px; padding: 30px; text-align: center;">
    <h1 style="color: #16a34a; margin-bottom: 10px;">Document Completed</h1>
    <p style="color: #666; font-size: 16px;">All parties have signed the document</p>
  </div>
  <div style="padding: 30px 0;">
    <h2 style="color: #1a1a2e;">{{documentTitle}}</h2>
    <p style="color: #444; line-height: 1.6;">
      The document has been fully signed by all parties.
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{documentLink}}" style="background: #16a34a; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
        View Document
      </a>
    </div>
  </div>
  <div style="border-top: 1px solid #eee; padding-top: 20px; color: #999; font-size: 12px; text-align: center;">
    This email was sent by Open Signature.
  </div>
</body>
</html>`,
  },
  {
    name: 'document_rejected',
    subject: 'Rejected: {{documentTitle}}',
    htmlBody: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #fef2f2; border-radius: 8px; padding: 30px; text-align: center;">
    <h1 style="color: #dc2626; margin-bottom: 10px;">Document Rejected</h1>
    <p style="color: #666; font-size: 16px;">A signer has rejected the document</p>
  </div>
  <div style="padding: 30px 0;">
    <h2 style="color: #1a1a2e;">{{documentTitle}}</h2>
    <p style="color: #444; line-height: 1.6;">
      <strong>{{signerName}}</strong> has rejected the document.
    </p>
    <p style="color: #444; line-height: 1.6;">
      <strong>Reason:</strong> {{rejectionReason}}
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{documentLink}}" style="background: #dc2626; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
        View Details
      </a>
    </div>
  </div>
  <div style="border-top: 1px solid #eee; padding-top: 20px; color: #999; font-size: 12px; text-align: center;">
    This email was sent by Open Signature.
  </div>
</body>
</html>`,
  },
  {
    name: 'reminder',
    subject: 'Reminder: {{documentTitle}}',
    htmlBody: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #fffbeb; border-radius: 8px; padding: 30px; text-align: center;">
    <h1 style="color: #d97706; margin-bottom: 10px;">Signing Reminder</h1>
    <p style="color: #666; font-size: 16px;">You have a pending document to sign</p>
  </div>
  <div style="padding: 30px 0;">
    <h2 style="color: #1a1a2e;">{{documentTitle}}</h2>
    <p style="color: #444; line-height: 1.6;">
      This is a friendly reminder that you have a document waiting for your signature.
    </p>
    <p style="color: #444; line-height: 1.6;">
      <strong>Requested by:</strong> {{senderName}}
    </p>
    <p style="color: #444; line-height: 1.6;">
      <strong>Due date:</strong> {{dueDate}}
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{signingLink}}" style="background: #d97706; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
        Sign Now
      </a>
    </div>
  </div>
  <div style="border-top: 1px solid #eee; padding-top: 20px; color: #999; font-size: 12px; text-align: center;">
    This email was sent by Open Signature.
  </div>
</body>
</html>`,
  },
  {
    name: 'otp_code',
    subject: 'Your verification code: {{code}}',
    htmlBody: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f0f9ff; border-radius: 8px; padding: 30px; text-align: center;">
    <h1 style="color: #0284c7; margin-bottom: 10px;">Verification Code</h1>
    <p style="color: #666; font-size: 16px;">Use this code to verify your identity</p>
  </div>
  <div style="padding: 30px 0; text-align: center;">
    <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a2e;">{{code}}</span>
    </div>
    <p style="color: #444; line-height: 1.6;">
      This code will expire in {{expiryMinutes}} minutes.
    </p>
    <p style="color: #999; font-size: 13px;">
      If you did not request this code, please ignore this email.
    </p>
  </div>
  <div style="border-top: 1px solid #eee; padding-top: 20px; color: #999; font-size: 12px; text-align: center;">
    This email was sent by Open Signature.
  </div>
</body>
</html>`,
  },
  {
    name: 'workflow_step',
    subject: 'Step {{step}}/{{total}}: {{documentTitle}}',
    htmlBody: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #faf5ff; border-radius: 8px; padding: 30px; text-align: center;">
    <h1 style="color: #7c3aed; margin-bottom: 10px;">Workflow Step</h1>
    <p style="color: #666; font-size: 16px;">Step {{step}} of {{total}} requires your action</p>
  </div>
  <div style="padding: 30px 0;">
    <h2 style="color: #1a1a2e;">{{documentTitle}}</h2>
    <p style="color: #444; line-height: 1.6;">
      The document has reached your step in the workflow.
    </p>
    <p style="color: #444; line-height: 1.6;">
      <strong>Action required:</strong> {{actionType}}
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{actionLink}}" style="background: #7c3aed; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
        Take Action
      </a>
    </div>
  </div>
  <div style="border-top: 1px solid #eee; padding-top: 20px; color: #999; font-size: 12px; text-align: center;">
    This email was sent by Open Signature.
  </div>
</body>
</html>`,
  },
];

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orgId } = body;

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const role = await getUserRole(user.userId, orgId);
    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await db.emailTemplate.findMany({
      where: { orgId },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((t) => t.name));

    const toCreate = defaultTemplates.filter((t) => !existingNames.has(t.name));

    if (toCreate.length === 0) {
      return NextResponse.json({ message: 'All default templates already exist', created: 0 });
    }

    const created = await db.emailTemplate.createMany({
      data: toCreate.map((t) => ({
        name: t.name,
        subject: t.subject,
        htmlBody: t.htmlBody,
        orgId,
        isDefault: true,
      })),
    });

    return NextResponse.json({ message: 'Default templates seeded', created: created.count }, { status: 201 });
  } catch (error) {
    console.error('Error seeding email templates:', error);
    return NextResponse.json(
      { error: 'Failed to seed email templates' },
      { status: 500 }
    );
  }
}
