import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import path from 'path';
import { readFile, writeFile } from 'fs/promises';
import { PDFDocument } from 'pdf-lib';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;

    const signer = await db.signer.findUnique({
      where: { token },
      include: { document: true },
    });

    if (!signer) return NextResponse.json({ error: 'Invalid signing link' }, { status: 404 });
    if (signer.signedAt) return NextResponse.json({ error: 'Already signed' }, { status: 400 });

    // Verify all fields are filled
    const unfilledFields = await db.documentField.findMany({
      where: { signerId: signer.id, value: null },
    });

    if (unfilledFields.length > 0) {
      return NextResponse.json(
        { error: `Please fill all required fields. ${unfilledFields.length} field(s) remaining.` },
        { status: 400 }
      );
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

    // Check if all signers have signed
    const allSigners = await db.signer.findMany({
      where: { documentId: signer.documentId },
    });
    const allSigned = allSigners.every((s) => s.signedAt !== null);

    if (allSigned) {
      // Generate signed PDF with embedded values
      const document = await db.document.findUnique({
        where: { id: signer.documentId },
        include: { fields: true },
      });

      if (document) {
        const pdfBytes = await readFile(path.join(UPLOADS_DIR, document.originalPdfPath));
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();

        for (const field of document.fields) {
          if (field.value && field.pageNumber > 0 && field.pageNumber <= pages.length) {
            const page = pages[field.pageNumber - 1];
            const { width: pw, height: ph } = page.getSize();

            // Note: PDF coordinates are bottom-left origin
            const pdfX = (field.x / 612) * pw; // Scale assuming 612 (US Letter) base
            const pdfY = ph - ((field.y + field.height) / 792) * ph; // Flip Y, base 792

            const fontSize = Math.max(8, Math.min(field.height * 0.6, 16));

            try {
              if (field.type === 'signature' && field.value.startsWith('data:image')) {
                // Embed signature image
                const base64Data = field.value.split(',')[1];
                const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
                let image;
                try {
                  image = await pdfDoc.embedPng(imageBytes);
                } catch {
                  // Try JPEG if PNG fails
                  image = await pdfDoc.embedJpg(imageBytes);
                }
                const imgWidth = field.width * (pw / 612);
                const imgHeight = field.height * (ph / 792);
                page.drawImage(image, {
                  x: pdfX,
                  y: pdfY,
                  width: Math.max(10, imgWidth),
                  height: Math.max(10, imgHeight),
                });
              } else {
                // Draw text
                page.drawText(field.value, {
                  x: Math.max(0, pdfX + 4),
                  y: Math.max(0, pdfY + fontSize * 0.3),
                  size: fontSize,
                  color: { r: 0, g: 0, b: 0.27 }, // Dark blue-black
                });
              }
            } catch (err) {
              console.error(`Failed to embed field ${field.id}:`, err);
            }
          }
        }

        const signedBytes = await pdfDoc.save();
        const signedFileName = `signed-${document.id}.pdf`;
        await writeFile(path.join(UPLOADS_DIR, signedFileName), signedBytes);

        await db.document.update({
          where: { id: signer.documentId },
          data: { status: 'Completed', signedPdfPath: signedFileName },
        });

        await db.auditLog.create({
          data: {
            action: 'DOCUMENT_COMPLETED',
            documentId: signer.documentId,
            details: 'All signers completed. Signed PDF generated and cryptographically sealed.',
            ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
            userAgent: req.headers.get('user-agent') || null,
          },
        });
      }
    }

    return NextResponse.json({ success: true, allSigned });
  } catch (error) {
    console.error('Complete signing error:', error);
    return NextResponse.json({ error: 'Failed to complete signing' }, { status: 500 });
  }
}