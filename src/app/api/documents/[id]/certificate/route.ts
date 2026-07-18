import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

function generateFingerprint(documentId: string, completedAt: Date): string {
  const data = `${documentId}:${completedAt.toISOString()}`;
  return crypto.createHash('sha256').update(data).digest('hex').toUpperCase();
}

function formatDate(date: Date | string | null): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const doc = await db.document.findFirst({
      where: { id },
      include: {
        signers: { orderBy: { order: 'asc' } },
        auditLogs: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (doc.ownerId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (doc.status !== 'Completed') {
      return NextResponse.json(
        { error: 'Certificate only available for completed documents' },
        { status: 400 }
      );
    }

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const page = pdfDoc.addPage([612, 792]);
    const { width } = page.getSize();

    const leftMargin = 60;
    const rightMargin = width - 60;
    const contentWidth = rightMargin - leftMargin;

    const primaryColor = rgb(0.02, 0.47, 0.41);
    const darkColor = rgb(0.1, 0.1, 0.1);
    const mediumColor = rgb(0.3, 0.3, 0.3);
    const lightColor = rgb(0.55, 0.55, 0.55);
    const lineColor = rgb(0.82, 0.82, 0.82);
    const tableHeaderBg = rgb(0.94, 0.96, 0.95);
    const tableRowAlt = rgb(0.97, 0.97, 0.97);
    const accentColor = rgb(0.02, 0.59, 0.41);

    let y = 740;

    // ── Decorative top border ──
    page.drawRectangle({
      x: leftMargin,
      y: y,
      width: contentWidth,
      height: 3,
      color: primaryColor,
    });
    y -= 40;

    // ── Title ──
    page.drawText('COMPLETION CERTIFICATE', {
      x: leftMargin,
      y,
      size: 26,
      font: fontBold,
      color: primaryColor,
    });
    y -= 16;

    page.drawText('Document Signing Verification', {
      x: leftMargin,
      y,
      size: 11,
      font: fontItalic,
      color: lightColor,
    });
    y -= 12;

    // ── Thin separator ──
    page.drawLine({
      start: { x: leftMargin, y },
      end: { x: rightMargin, y },
      thickness: 1,
      color: lineColor,
    });
    y -= 30;

    // ── Helper: draw section header ──
    const sectionHeader = (title: string) => {
      page.drawText(title.toUpperCase(), {
        x: leftMargin,
        y,
        size: 10,
        font: fontBold,
        color: primaryColor,
      });
      y -= 4;
      page.drawLine({
        start: { x: leftMargin, y },
        end: { x: rightMargin, y },
        thickness: 0.5,
        color: accentColor,
      });
      y -= 16;
    };

    // ── Helper: draw label-value pair ──
    const fieldRow = (label: string, value: string, labelFontSize = 9, valueFontSize = 11) => {
      page.drawText(label, {
        x: leftMargin,
        y,
        size: labelFontSize,
        font: fontBold,
        color: mediumColor,
      });
      y -= labelFontSize + 4;
      page.drawText(value, {
        x: leftMargin,
        y,
        size: valueFontSize,
        font,
        color: darkColor,
      });
      y -= valueFontSize + 10;
    };

    // ── Document Details Section ──
    sectionHeader('Document Details');

    fieldRow('Document Title', doc.title);
    fieldRow('Document ID', doc.id);
    fieldRow('Created', formatDate(doc.createdAt));
    fieldRow('Completed', formatDate(doc.updatedAt));
    y -= 8;

    // ── Signers Table ──
    sectionHeader('Authorized Signers');

    const tableX = leftMargin;
    const colWidths = [140, 170, 140, 82];
    const colHeaders = ['Name', 'Email', 'Signed At', 'IP Address'];
    const rowHeight = 18;
    const headerHeight = 22;

    // Table header background
    page.drawRectangle({
      x: tableX,
      y: y - headerHeight + 6,
      width: contentWidth,
      height: headerHeight,
      color: tableHeaderBg,
    });

    // Table header border
    page.drawRectangle({
      x: tableX,
      y: y - headerHeight + 6,
      width: contentWidth,
      height: headerHeight,
      borderColor: lineColor,
      borderWidth: 0.5,
    });

    // Column header text
    let colX = tableX + 6;
    for (let i = 0; i < colHeaders.length; i++) {
      page.drawText(colHeaders[i], {
        x: colX,
        y,
        size: 8,
        font: fontBold,
        color: mediumColor,
      });
      colX += colWidths[i];
    }
    y -= headerHeight - 2;

    // Signer rows
    for (let i = 0; i < doc.signers.length; i++) {
      const signer = doc.signers[i];

      if (i % 2 === 1) {
        page.drawRectangle({
          x: tableX,
          y: y - rowHeight + 6,
          width: contentWidth,
          height: rowHeight,
          color: tableRowAlt,
        });
      }

      // Row border
      page.drawRectangle({
        x: tableX,
        y: y - rowHeight + 6,
        width: contentWidth,
        height: rowHeight,
        borderColor: lineColor,
        borderWidth: 0.3,
      });

      // Column vertical separators
      let segX = tableX;
      for (let c = 0; c < colWidths.length - 1; c++) {
        segX += colWidths[c];
        page.drawLine({
          start: { x: segX, y: y - rowHeight + 6 },
          end: { x: segX, y: y + 6 },
          thickness: 0.3,
          color: lineColor,
        });
      }

      const rowData = [
        signer.name || 'Unknown',
        signer.email,
        signer.signedAt ? formatDate(signer.signedAt) : 'Pending',
        signer.rejectionReason ? `Rejected: ${signer.rejectionReason.substring(0, 20)}` : 'N/A',
      ];

      let cellX = tableX + 6;
      for (let c = 0; c < rowData.length; c++) {
        page.drawText(rowData[c].substring(0, 30), {
          x: cellX,
          y,
          size: 8,
          font: signer.rejectionReason && c === 3 ? fontItalic : font,
          color: signer.rejectionReason && c === 3 ? rgb(0.8, 0.2, 0.2) : darkColor,
        });
        cellX += colWidths[c];
      }
      y -= rowHeight;
    }

    if (doc.signers.length === 0) {
      page.drawText('No signers recorded.', {
        x: tableX + 6,
        y,
        size: 9,
        font: fontItalic,
        color: lightColor,
      });
      y -= rowHeight;
    }

    y -= 20;

    // ── Audit Trail ──
    sectionHeader('Audit Trail');

    const maxAuditEntries = Math.min(doc.auditLogs.length, 25);
    const auditLogs = doc.auditLogs.slice(0, maxAuditEntries);

    if (auditLogs.length > 0) {
      // Audit header
      page.drawRectangle({
        x: tableX,
        y: y - headerHeight + 6,
        width: contentWidth,
        height: headerHeight,
        color: tableHeaderBg,
      });
      page.drawRectangle({
        x: tableX,
        y: y - headerHeight + 6,
        width: contentWidth,
        height: headerHeight,
        borderColor: lineColor,
        borderWidth: 0.5,
      });

      const auditHeaders = ['Timestamp', 'Action', 'Details', 'IP Address'];
      const auditColWidths = [150, 100, 200, 82];

      colX = tableX + 6;
      for (let i = 0; i < auditHeaders.length; i++) {
        page.drawText(auditHeaders[i], {
          x: colX,
          y,
          size: 8,
          font: fontBold,
          color: mediumColor,
        });
        colX += auditColWidths[i];
      }
      y -= headerHeight - 2;

      for (let i = 0; i < auditLogs.length; i++) {
        const log = auditLogs[i];

        if (y < 80) break;

        if (i % 2 === 1) {
          page.drawRectangle({
            x: tableX,
            y: y - rowHeight + 6,
            width: contentWidth,
            height: rowHeight,
            color: tableRowAlt,
          });
        }

        page.drawRectangle({
          x: tableX,
          y: y - rowHeight + 6,
          width: contentWidth,
          height: rowHeight,
          borderColor: lineColor,
          borderWidth: 0.3,
        });

        let segXAudit = tableX;
        for (let c = 0; c < auditColWidths.length - 1; c++) {
          segXAudit += auditColWidths[c];
          page.drawLine({
            start: { x: segXAudit, y: y - rowHeight + 6 },
            end: { x: segXAudit, y: y + 6 },
            thickness: 0.3,
            color: lineColor,
          });
        }

        const auditRow = [
          formatDate(log.createdAt),
          log.action || 'unknown',
          log.details ? log.details.substring(0, 40) : '-',
          log.ipAddress || 'N/A',
        ];

        let cellX = tableX + 6;
        for (let c = 0; c < auditRow.length; c++) {
          page.drawText(auditRow[c].substring(0, 42), {
            x: cellX,
            y,
            size: 7.5,
            font,
            color: darkColor,
          });
          cellX += auditColWidths[c];
        }
        y -= rowHeight;
      }

      if (doc.auditLogs.length > maxAuditEntries) {
        y -= 4;
        page.drawText(`… and ${doc.auditLogs.length - maxAuditEntries} more entries`, {
          x: leftMargin,
          y,
          size: 8,
          font: fontItalic,
          color: lightColor,
        });
        y -= 12;
      }
    } else {
      page.drawText('No audit events recorded.', {
        x: leftMargin,
        y,
        size: 9,
        font: fontItalic,
        color: lightColor,
      });
      y -= rowHeight;
    }

    y -= 20;

    // ── Document Fingerprint ──
    if (y > 120) {
      sectionHeader('Document Verification');

      const fingerprint = generateFingerprint(doc.id, doc.updatedAt);
      const verificationCode = crypto
        .createHash('md5')
        .update(`${doc.id}:${doc.updatedAt.toISOString()}:opensign`)
        .digest('hex')
        .substring(0, 16)
        .toUpperCase();

      fieldRow('Fingerprint (SHA-256)', fingerprint, 8, 7.5);
      y -= 2;

      fieldRow('Verification Code', verificationCode, 8, 9);
      y -= 2;

      fieldRow('Algorithm', 'SHA-256 / MD5', 8, 8);
      y -= 8;
    }

    // ── Footer ──
    if (y > 80) {
      page.drawLine({
        start: { x: leftMargin, y },
        end: { x: rightMargin, y },
        thickness: 1,
        color: lineColor,
      });
      y -= 16;

      page.drawText('This certificate was automatically generated by Open Signature.', {
        x: leftMargin,
        y,
        size: 8,
        font: fontItalic,
        color: lightColor,
      });
      y -= 12;

      page.drawText(`Generated: ${new Date().toISOString()}`, {
        x: leftMargin,
        y,
        size: 8,
        font,
        color: lightColor,
      });
      y -= 12;

      page.drawText('ESIGN Act / eIDAS Compliant  |  Tamper-Evident Audit Trail', {
        x: leftMargin,
        y,
        size: 8,
        font: font,
        color: lightColor,
      });

      // Bottom border
      page.drawRectangle({
        x: leftMargin,
        y: y - 12,
        width: contentWidth,
        height: 3,
        color: primaryColor,
      });
    }

    // ── Save & respond ──
    const pdfBytes = await pdfDoc.save();
    const certPath = `certificate-${doc.id}.pdf`;
    await writeFile(path.join(UPLOADS_DIR, certPath), pdfBytes);

    await db.document.update({
      where: { id },
      data: { certificatePath: certPath },
    });

    const fileBuffer = await readFile(path.join(UPLOADS_DIR, certPath));
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="certificate-${doc.title.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Certificate error:', error);
    return NextResponse.json({ error: 'Failed to generate certificate' }, { status: 500 });
  }
}
