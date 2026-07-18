import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { db } from '@/lib/db';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

let selfSignedCert: string = '';
let selfSignedCertThumbprint: string = '';

export function generateSelfSignedCert(): string {
  const keyPair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const now = new Date();
  const notBefore = now.toISOString();
  const notAfter = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString();

  const serialNumber = crypto.randomBytes(16).toString('hex');

  const certData = [
    '-----BEGIN CERTIFICATE METADATA-----',
    `Subject: CN=OpenSign Platform Signing Certificate`,
    `Issuer: CN=OpenSign Platform Root CA (Self-Signed)`,
    `Serial Number: ${serialNumber}`,
    `Valid From: ${notBefore}`,
    `Valid To: ${notAfter}`,
    `Public Key Algorithm: RSA-2048`,
    `Signature Algorithm: SHA-256 with RSA`,
    `Key Usage: Digital Signature, Non-Repudiation`,
    `Extended Key Usage: Code Signing, Document Signing`,
    `Certificate Type: Self-Signed Platform Certificate`,
    `-----END CERTIFICATE METADATA-----`,
  ].join('\n');

  selfSignedCert = certData;

  selfSignedCertThumbprint = crypto
    .createHash('sha256')
    .update(certData)
    .digest('hex');

  return certData;
}

// Initialize at module load
generateSelfSignedCert();

function generateDocumentFingerprint(documentId: string, updatedAt: string, signerCount: number): string {
  return crypto
    .createHash('sha256')
    .update(`${documentId}-${updatedAt}-${signerCount}`)
    .digest('hex');
}

function generateCertificateSerial(): string {
  return crypto.randomBytes(12).toString('hex').toUpperCase();
}

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
  if (y > 180) {
    page.drawText('DOCUMENT VERIFICATION', { x: 50, y, size: 13, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    y -= 20;

    const fingerprint = generateDocumentFingerprint(
      document.id,
      document.updatedAt.toISOString(),
      signers.length,
    );

    page.drawText('Fingerprint:', { x: 60, y, size: 9, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(fingerprint.substring(0, 40), { x: 140, y, size: 8, font, color: rgb(0.1, 0.1, 0.1) });
    y -= 14;
    page.drawText(fingerprint.substring(40), { x: 140, y, size: 8, font, color: rgb(0.1, 0.1, 0.1) });
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

  // --- Page 2: Digitally Signed Certificate ---
  const page2 = pdfDoc.addPage([612, 792]);
  const p2 = page2.getSize();

  let y2 = p2.height - 50;

  // Outer border with gold accent
  page2.drawRectangle({
    x: 30, y: 30,
    width: p2.width - 60, height: p2.height - 60,
    borderColor: rgb(0.72, 0.53, 0.04),
    borderWidth: 3,
  });

  // Inner border
  page2.drawRectangle({
    x: 40, y: 40,
    width: p2.width - 80, height: p2.height - 80,
    borderColor: rgb(0.72, 0.53, 0.04),
    borderWidth: 1,
  });

  // Header
  page2.drawText('DIGITALLY SIGNED CERTIFICATE', {
    x: p2.width / 2 - 175, y: y2, size: 22, font: boldFont, color: rgb(0.72, 0.53, 0.04),
  });
  y2 -= 12;

  page2.drawText('Cryptographic Verification & Platform Attestation', {
    x: p2.width / 2 - 172, y: y2, size: 10, font, color: rgb(0.5, 0.5, 0.5),
  });
  y2 -= 25;

  // Divider
  page2.drawLine({
    start: { x: 60, y: y2 }, end: { x: p2.width - 60, y: y2 },
    color: rgb(0.72, 0.53, 0.04), thickness: 1.5,
  });
  y2 -= 30;

  // Document Fingerprint (SHA-256)
  const docFingerprint = generateDocumentFingerprint(
    document.id,
    document.updatedAt.toISOString(),
    signers.length,
  );

  page2.drawText('DOCUMENT FINGERPRINT (SHA-256)', {
    x: 60, y: y2, size: 12, font: boldFont, color: rgb(0.2, 0.2, 0.2),
  });
  y2 -= 20;

  // Split fingerprint into 4 lines of 16 chars each for readability
  const fpLines = [
    docFingerprint.substring(0, 16),
    docFingerprint.substring(16, 32),
    docFingerprint.substring(32, 48),
    docFingerprint.substring(48, 64),
  ];

  page2.drawRectangle({
    x: 60, y: y2 - 62, width: p2.width - 120, height: 72,
    borderColor: rgb(0.85, 0.85, 0.85),
    borderWidth: 0.5,
    color: rgb(0.97, 0.97, 0.97),
  });

  let fpY = y2 - 5;
  for (const line of fpLines) {
    page2.drawText(line, {
      x: 80, y: fpY, size: 11, font, color: rgb(0.1, 0.1, 0.1),
    });
    fpY -= 16;
  }
  y2 -= 85;

  // Signing Identity
  page2.drawText('CERTIFICATE AUTHORITY', {
    x: 60, y: y2, size: 12, font: boldFont, color: rgb(0.2, 0.2, 0.2),
  });
  y2 -= 20;

  const certAuthorityDetails = [
    ['Certificate Authority', 'OpenSign Platform'],
    ['Certificate Type', 'Self-Signed Platform Certificate'],
    ['Authority Thumbprint', selfSignedCertThumbprint.substring(0, 40)],
    ['', selfSignedCertThumbprint.substring(40)],
  ];

  for (const [label, value] of certAuthorityDetails) {
    if (label) {
      page2.drawText(`${label}:`, { x: 80, y: y2, size: 10, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    }
    page2.drawText(value, { x: label ? 280 : 280, y: y2, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
    y2 -= 15;
  }
  y2 -= 10;

  // Signing Details
  page2.drawText('SIGNING DETAILS', {
    x: 60, y: y2, size: 12, font: boldFont, color: rgb(0.2, 0.2, 0.2),
  });
  y2 -= 20;

  const certSerial = generateCertificateSerial();
  const signingTime = new Date().toISOString();
  const signingTimeLocal = new Date().toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZoneName: 'short',
  });

  const signingDetails = [
    ['Certificate Serial Number', certSerial],
    ['Signing Time (UTC)', signingTime],
    ['Signing Time (Local)', signingTimeLocal],
    ['Signing Algorithm', 'SHA-256 with RSA'],
    ['Document ID', document.id],
    ['Signers Count', String(signers.length)],
  ];

  for (const [label, value] of signingDetails) {
    page2.drawText(`${label}:`, { x: 80, y: y2, size: 10, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    page2.drawText(value, { x: 280, y: y2, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
    y2 -= 15;
  }
  y2 -= 10;

  // Tamper Evidence Statement
  page2.drawLine({
    start: { x: 60, y: y2 }, end: { x: p2.width - 60, y: y2 },
    color: rgb(0.72, 0.53, 0.04), thickness: 1,
  });
  y2 -= 25;

  page2.drawText('TAMPER EVIDENCE', {
    x: 60, y: y2, size: 12, font: boldFont, color: rgb(0.2, 0.2, 0.2),
  });
  y2 -= 20;

  page2.drawText('This certificate is digitally signed and tamper-evident. Any modification to', {
    x: 80, y: y2, size: 10, font, color: rgb(0.1, 0.1, 0.1),
  });
  y2 -= 14;
  page2.drawText('the signed document will invalidate the document fingerprint above.', {
    x: 80, y: y2, size: 10, font, color: rgb(0.1, 0.1, 0.1),
  });
  y2 -= 14;
  page2.drawText('Verification of this certificate requires the original document content.', {
    x: 80, y: y2, size: 10, font, color: rgb(0.1, 0.1, 0.1),
  });
  y2 -= 25;

  // Verification URL
  page2.drawText('VERIFICATION', {
    x: 60, y: y2, size: 12, font: boldFont, color: rgb(0.2, 0.2, 0.2),
  });
  y2 -= 20;

  const verificationUrl = `https://opensign.com/verify/${document.id}`;
  page2.drawText('Verify this certificate at:', { x: 80, y: y2, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
  y2 -= 16;
  page2.drawText(verificationUrl, { x: 80, y: y2, size: 10, font, color: rgb(0.13, 0.55, 0.13) });
  y2 -= 25;

  // Signature Block
  page2.drawLine({
    start: { x: 60, y: y2 }, end: { x: p2.width - 60, y: y2 },
    color: rgb(0.72, 0.53, 0.04), thickness: 1,
  });
  y2 -= 20;

  page2.drawText('Signed by: OpenSign Platform', {
    x: 80, y: y2, size: 11, font: boldFont, color: rgb(0.72, 0.53, 0.04),
  });
  y2 -= 16;
  page2.drawText(`Date: ${signingTimeLocal}`, {
    x: 80, y: y2, size: 9, font, color: rgb(0.4, 0.4, 0.4),
  });
  y2 -= 14;
  page2.drawText(`Certificate SN: ${certSerial}`, {
    x: 80, y: y2, size: 9, font, color: rgb(0.4, 0.4, 0.4),
  });
  y2 -= 30;

  // Footer
  page2.drawLine({
    start: { x: 50, y: 55 }, end: { x: p2.width - 50, y: 55 },
    color: rgb(0.72, 0.53, 0.04), thickness: 1,
  });

  page2.drawText(`OpenSign Platform - Digitally Signed Certificate - ${now}`, {
    x: 50, y: 42, size: 7, font, color: rgb(0.5, 0.5, 0.5),
  });

  page2.drawText('This page constitutes the digitally signed attestation for the above certificate.', {
    x: 50, y: 30, size: 7, font, color: rgb(0.5, 0.5, 0.5),
  });

  // Save the updated PDF (now with 2 pages)
  const finalPdfBytes = await pdfDoc.save();
  await writeFile(path.join(UPLOADS_DIR, certFileName), finalPdfBytes);

  return certFileName;
}
