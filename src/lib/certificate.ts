import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { db } from '@/lib/db';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

export async function generateCertificate(documentId: string): Promise<string> {
  const document = await db.document.findUnique({
    where: { id: documentId },
    include: {
      signers: true,
      fields: true,
      auditLogs: { orderBy: { createdAt: 'asc' } },
      owner: true,
    },
  });

  if (!document) throw new Error('Document not found');
  if (document.status !== 'Completed') throw new Error('Document not completed');

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([612, 792]);
  const { width, height } = page.getSize();

  let y = height - 50;

  // Header border
  page.drawRectangle({
    x: 30, y: 30,
    width: width - 60, height: height - 60,
    borderColor: rgb(0.13, 0.55, 0.13),
    borderWidth: 2,
  });

  // Title
  page.drawText('COMPLETION CERTIFICATE', {
    x: width / 2 - 140, y, size: 24, font: boldFont, color: rgb(0.13, 0.55, 0.13),
  });
  y -= 15;

  page.drawText('Document Electronic Signature Verification', {
    x: width / 2 - 155, y, size: 11, font, color: rgb(0.4, 0.4, 0.4),
  });
  y -= 30;

  // Divider
  page.drawLine({
    start: { x: 50, y }, end: { x: width - 50, y },
    color: rgb(0.13, 0.55, 0.13), thickness: 1,
  });
  y -= 25;

  // Document Details
  page.drawText('DOCUMENT DETAILS', { x: 50, y, size: 13, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  y -= 20;

  const details = [
    ['Document Title', document.title],
    ['Document ID', document.id],
    ['Status', 'Completed'],
    ['Created', document.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
    ['Completed', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
    ['Owner', `${document.owner.name} (${document.owner.email})`],
  ];

  for (const [label, value] of details) {
    page.drawText(`${label}:`, { x: 60, y, size: 10, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(String(value), { x: 200, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
    y -= 16;
  }
  y -= 10;

  // Signers Section
  page.drawText('SIGNER VERIFICATION', { x: 50, y, size: 13, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  y -= 20;

  const signers = document.signers.filter(s => s.signedAt);
  if (signers.length > 0) {
    // Table header
    page.drawText('Name', { x: 60, y, size: 9, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('Email', { x: 200, y, size: 9, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('Signed At', { x: 370, y, size: 9, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('Role', { x: 500, y, size: 9, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    y -= 5;

    page.drawLine({
      start: { x: 50, y }, end: { x: width - 50, y },
      color: rgb(0.7, 0.7, 0.7), thickness: 0.5,
    });
    y -= 14;

    for (const signer of signers) {
      const bgColor = signers.indexOf(signer) % 2 === 0 ? rgb(0.96, 0.96, 0.96) : rgb(1, 1, 1);
      page.drawRectangle({
        x: 50, y: y - 4, width: width - 100, height: 16,
        color: bgColor,
      });

      page.drawText(signer.name || 'N/A', { x: 60, y, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(signer.email, { x: 200, y, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
      const signedDate = signer.signedAt?.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }) || 'N/A';
      page.drawText(signedDate, { x: 370, y, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(signer.role || 'signer', { x: 500, y, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 16;
    }
  } else {
    page.drawText('No signers recorded.', { x: 60, y, size: 10, font, color: rgb(0.5, 0.5, 0.5) });
    y -= 16;
  }
  y -= 15;

  // Audit Trail
  page.drawText('AUDIT TRAIL', { x: 50, y, size: 13, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  y -= 20;

  const auditLogs = document.auditLogs.slice(0, 20);
  if (auditLogs.length > 0) {
    page.drawText('Timestamp', { x: 60, y, size: 9, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('Action', { x: 210, y, size: 9, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('IP Address', { x: 380, y, size: 9, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    y -= 5;

    page.drawLine({
      start: { x: 50, y }, end: { x: width - 50, y },
      color: rgb(0.7, 0.7, 0.7), thickness: 0.5,
    });
    y -= 14;

    for (const log of auditLogs) {
      if (y < 80) break;
      const ts = log.createdAt.toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      page.drawText(ts, { x: 60, y, size: 8, font, color: rgb(0.2, 0.2, 0.2) });
      page.drawText(log.action, { x: 210, y, size: 8, font, color: rgb(0.2, 0.2, 0.2) });
      page.drawText(log.ipAddress || 'N/A', { x: 380, y, size: 8, font, color: rgb(0.2, 0.2, 0.2) });
      y -= 14;
    }
  }
  y -= 15;

  // Document Verification
  if (y > 120) {
    page.drawText('DOCUMENT VERIFICATION', { x: 50, y, size: 13, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    y -= 20;

    const hash = crypto.createHash('sha256')
      .update(`${document.id}-${document.updatedAt.toISOString()}-${signers.length}`)
      .digest('hex');

    page.drawText('Fingerprint:', { x: 60, y, size: 9, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(hash.substring(0, 40), { x: 140, y, size: 8, font, color: rgb(0.1, 0.1, 0.1) });
    y -= 14;
    page.drawText(hash.substring(40), { x: 140, y, size: 8, font, color: rgb(0.1, 0.1, 0.1) });
    y -= 18;

    const verifyCode = crypto.createHash('md5')
      .update(document.id + document.updatedAt.toISOString())
      .digest('hex')
      .substring(0, 12)
      .toUpperCase();

    page.drawText('Verification Code:', { x: 60, y, size: 9, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(verifyCode, { x: 180, y, size: 10, font: boldFont, color: rgb(0.13, 0.55, 0.13) });
    y -= 18;

    page.drawText('Algorithm: SHA-256 + MD5', { x: 60, y, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
    y -= 30;
  }

  // Footer
  page.drawLine({
    start: { x: 50, y: 55 }, end: { x: width - 50, y: 55 },
    color: rgb(0.13, 0.55, 0.13), thickness: 1,
  });

  const now = new Date().toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  page.drawText(`Generated: ${now}`, {
    x: 50, y: 42, size: 8, font, color: rgb(0.5, 0.5, 0.5),
  });

  page.drawText('This certificate verifies the document signing process was completed.', {
    x: 50, y: 30, size: 7, font, color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  const certFileName = `certificate-${documentId}.pdf`;
  await writeFile(path.join(UPLOADS_DIR, certFileName), pdfBytes);

  return certFileName;
}
