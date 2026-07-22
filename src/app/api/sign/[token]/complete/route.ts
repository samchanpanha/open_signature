import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PDFDocument, rgb } from 'pdf-lib';
import { getAlertEngine } from '@/lib/alerts/alert-engine';
import { dispatchWebhook } from '@/lib/webhooks';
import { readPdfStorage, writePdfStorage } from '@/lib/s3';
import { createAuditLog, auditFromRequest } from '@/lib/audit';

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;

    const signer = await db.signer.findUnique({
      where: { token },
      include: { document: true },
    });

    if (!signer) return NextResponse.json({ error: 'Invalid signing link' }, { status: 404 });
    if (signer.signedAt) return NextResponse.json({ error: 'Already signed' }, { status: 400 });

    // Enforce OTP verification when the document requires it
    if (signer.document.requireOtp && !signer.otpVerifiedAt) {
      return NextResponse.json(
        { error: 'Email verification required before completing signing', code: 'OTP_REQUIRED' },
        { status: 401 }
      );
    }

    // Verify all fields are filled (viewers and approvers skip this)
    if (signer.role !== 'viewer' && signer.role !== 'approver') {
      const unfilledFields = await db.documentField.findMany({
        where: { signerId: signer.id, value: null },
      });

      if (unfilledFields.length > 0) {
        return NextResponse.json(
          { error: `Please fill all required fields. ${unfilledFields.length} field(s) remaining.` },
          { status: 400 }
        );
      }
    }

    // Mark signer as signed
    await db.signer.update({
      where: { id: signer.id },
      data: { signedAt: new Date() },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        action: 'SIGNER_COMPLETED',
        documentId: signer.documentId,
        signerId: signer.id,
        details: `Signer ${signer.name} (${signer.email}) completed signing`,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        userAgent: req.headers.get('user-agent') || null,
      },
    });

    await createAuditLog(auditFromRequest(req, {
      action: 'DOCUMENT_SIGNED',
      documentId: signer.documentId,
      resourceType: 'document',
      resourceId: signer.documentId,
      details: `Signer ${signer.name} (${signer.email}) completed signing`,
    }));

    // Dispatch webhook
    if (signer.document.organizationId) {
      dispatchWebhook(signer.document.organizationId, 'signer.signed', {
        documentId: signer.documentId,
        signerEmail: signer.email,
        signerName: signer.name,
        signedAt: new Date().toISOString(),
      });
    }

    // Check if all signers have signed
    const allSigners = await db.signer.findMany({
      where: { documentId: signer.documentId },
    });
    const allSigned = allSigners.every((s) => s.signedAt !== null);

    // Load document with workflow info
    const document = await db.document.findUnique({
      where: { id: signer.documentId },
      include: { fields: true, workflow: { include: { steps: { orderBy: { order: 'asc' } } } } },
    });

    if (allSigned && document) {
      const pdfBytes = await readPdfStorage(document.originalPdfPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();

      for (const field of document.fields) {
        if (field.value && field.pageNumber > 0 && field.pageNumber <= pages.length) {
          const page = pages[field.pageNumber - 1];
          const { width: pw, height: ph } = page.getSize();

          const pdfX = (field.x / 612) * pw;
          const pdfY = ph - ((field.y + field.height) / 792) * ph;
          const fontSize = Math.max(8, Math.min(field.height * 0.6, 16));

          try {
            if (field.type === 'signature' && field.value.startsWith('data:image')) {
              const base64Data = field.value.split(',')[1];
              const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
              let image;
              try {
                image = await pdfDoc.embedPng(imageBytes);
              } catch {
                image = await pdfDoc.embedJpg(imageBytes);
              }
              const imgWidth = field.width * (pw / 612);
              const imgHeight = field.height * (ph / 792);
              page.drawImage(image, {
                x: pdfX, y: pdfY,
                width: Math.max(10, imgWidth),
                height: Math.max(10, imgHeight),
              });
            } else {
              const displayValue = field.type === 'checkbox' && field.value
                ? `☑ ${field.value}`
                : field.type === 'dropdown' && field.value
                  ? `▼ ${field.value}`
                  : field.value;
              page.drawText(displayValue, {
                x: Math.max(0, pdfX + 4),
                y: Math.max(0, pdfY + fontSize * 0.3),
                size: fontSize,
                color: rgb(0, 0, 0.27),
              });
            }
          } catch (err) {
            console.error(`Failed to embed field ${field.id}:`, err);
          }
        }
      }

      const signedBytes = await pdfDoc.save();
      const signedFileName = `signed-${document.id}.pdf`;
      await writePdfStorage(signedFileName, Buffer.from(signedBytes));

      // Update status to Completed BEFORE generating certificate
      await db.document.update({
        where: { id: signer.documentId },
        data: { status: 'Completed', signedPdfPath: signedFileName },
      });

      // Generate completion certificate (after status is set to Completed)
      try {
        const { generateCertificate } = await import('@/lib/certificate');
        const certPath = await generateCertificate(document.id);
        await db.document.update({
          where: { id: signer.documentId },
          data: { certificatePath: certPath },
        });
      } catch (err) {
        console.error('Failed to generate certificate:', err);
      }

      if (document.workflow) {
        await db.auditLog.create({
          data: {
            action: 'DOCUMENT_COMPLETED',
            documentId: signer.documentId,
            details: `All workflow steps completed. Signed PDF generated.`,
            ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
            userAgent: req.headers.get('user-agent') || null,
          },
        });
        const alertEngine = getAlertEngine();
        await alertEngine.notifyDocumentOwner(document.ownerId, document.title, document.id, 'completed', document.organizationId ?? undefined);
      } else {
        await db.auditLog.create({
          data: {
            action: 'DOCUMENT_COMPLETED',
            documentId: signer.documentId,
            details: 'All signers completed. Signed PDF generated and cryptographically sealed.',
            ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
            userAgent: req.headers.get('user-agent') || null,
          },
        });
      }
    } else if (!allSigned && document?.workflow) {
      // Not all signers done yet — workflow: notify next signer in sequence
      const alertEngine = getAlertEngine();
      const nextSigner = allSigners
        .filter(s => !s.signedAt)
        .sort((a, b) => a.order - b.order)[0];

      if (nextSigner) {
        const step = document.workflow.steps.find(s => s.order === nextSigner.order);
        if (step) {
          await alertEngine.notifyWorkflowStep(
            step,
            document.title,
            document.id,
            nextSigner.order,
            document.workflow.steps.length,
            document.organizationId ?? undefined
          );
        }
      }

      // Update status to Signing
      await db.document.update({
        where: { id: signer.documentId },
        data: { status: 'Signing' },
      });
    }

    return NextResponse.json({ success: true, allSigned });
  } catch (error) {
    console.error('Complete signing error:', error);
    return NextResponse.json({ error: 'Failed to complete signing' }, { status: 500 });
  }
}
