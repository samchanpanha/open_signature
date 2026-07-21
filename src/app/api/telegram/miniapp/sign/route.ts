import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/permissions";

/**
 * GET /api/telegram/miniapp/sign?token=xxx
 * Returns signing info for a document (Mini App version).
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

    const signer = await db.signer.findUnique({
      where: { token },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            originalPdfPath: true,
            status: true,
            requireOtp: true,
            expiresAt: true,
          },
        },
      },
    });

    if (!signer) return NextResponse.json({ error: "Invalid signing link" }, { status: 404 });
    if (signer.signedAt) return NextResponse.json({ error: "Already signed" }, { status: 400 });

    // Check expiry
    if (signer.document.expiresAt && new Date(signer.document.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Document expired" }, { status: 410 });
    }

    const fields = await db.documentField.findMany({
      where: { documentId: signer.documentId, signerId: signer.id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      document: {
        id: signer.document.id,
        title: signer.document.title,
        status: signer.document.status,
        requireOtp: signer.document.requireOtp,
      },
      signer: {
        id: signer.id,
        name: signer.name,
        email: signer.email,
        role: signer.role,
        signedAt: signer.signedAt,
        rejectedAt: signer.rejectedAt,
      },
      fields: fields.map((f) => ({
        id: f.id,
        type: f.type,
        label: f.label,
        required: f.required,
        options: f.options,
        pageNumber: f.pageNumber,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        value: f.value,
      })),
    });
  } catch (err) {
    console.error("miniapp sign info error:", err);
    return NextResponse.json({ error: "Failed to load signing info" }, { status: 500 });
  }
}

/**
 * PUT /api/telegram/miniapp/sign
 * Updates a field value (Mini App version).
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { fieldId, value, signerToken } = await req.json();
    if (!fieldId || !signerToken) {
      return NextResponse.json({ error: "fieldId and signerToken required" }, { status: 400 });
    }

    const signer = await db.signer.findUnique({ where: { token: signerToken } });
    if (!signer) return NextResponse.json({ error: "Invalid signer" }, { status: 404 });
    if (signer.signedAt) return NextResponse.json({ error: "Already signed" }, { status: 400 });

    const field = await db.documentField.findFirst({
      where: { id: fieldId, signerId: signer.id },
    });
    if (!field) return NextResponse.json({ error: "Field not found" }, { status: 404 });

    await db.documentField.update({
      where: { id: fieldId },
      data: { value },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("miniapp field update error:", err);
    return NextResponse.json({ error: "Failed to update field" }, { status: 500 });
  }
}

/**
 * POST /api/telegram/miniapp/sign
 * Completes signing (Mini App version).
 */
export async function POST(req: NextRequest) {
  try {
    const { signerToken } = await req.json();
    if (!signerToken) return NextResponse.json({ error: "signerToken required" }, { status: 400 });

    const signer = await db.signer.findUnique({
      where: { token: signerToken },
      include: { document: true },
    });

    if (!signer) return NextResponse.json({ error: "Invalid signing link" }, { status: 404 });
    if (signer.signedAt) return NextResponse.json({ error: "Already signed" }, { status: 400 });

    // Check OTP if required
    if (signer.document.requireOtp && !signer.otpVerifiedAt) {
      return NextResponse.json({ error: "OTP verification required", code: "OTP_REQUIRED" }, { status: 401 });
    }

    // Verify all fields are filled
    if (signer.role !== "viewer" && signer.role !== "approver") {
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

    // Mark as signed
    await db.signer.update({
      where: { id: signer.id },
      data: { signedAt: new Date() },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        action: "SIGNER_COMPLETED",
        documentId: signer.documentId,
        signerId: signer.id,
        details: `Signer ${signer.name} (${signer.email}) completed signing via Mini App`,
        ipAddress: "miniapp",
      },
    });

    // Check if all signers done
    const allSigners = await db.signer.findMany({
      where: { documentId: signer.documentId },
    });
    const allSigned = allSigners.every((s) => s.signedAt !== null);

    if (allSigned) {
      await db.document.update({
        where: { id: signer.documentId },
        data: { status: "Completed" },
      });
    }

    return NextResponse.json({ success: true, allSigned });
  } catch (err) {
    console.error("miniapp complete signing error:", err);
    return NextResponse.json({ error: "Failed to complete signing" }, { status: 500 });
  }
}
