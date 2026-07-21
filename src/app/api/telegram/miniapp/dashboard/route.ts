import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/permissions";

/**
 * GET /api/telegram/miniapp/dashboard
 * Returns dashboard data for the Mini App (pending docs, stats, notifications).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = user.userId as string;
    const userEmail = user.email as string;

    // Documents pending signature for this user
    const pendingSigners = await db.signer.findMany({
      where: {
        email: userEmail,
        signedAt: null,
        rejectedAt: null,
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            status: true,
            ownerId: true,
            expiresAt: true,
            requireOtp: true,
            createdAt: true,
            owner: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Documents owned by user
    const ownedDocs = await db.document.findMany({
      where: { ownerId: userId },
      select: { id: true, title: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Stats
    const totalDocs = await db.document.count({ where: { ownerId: userId } });
    const completedDocs = await db.document.count({ where: { ownerId: userId, status: "Completed" } });
    const pendingCount = pendingSigners.length;
    const sentDocs = await db.document.count({ where: { ownerId: userId, status: "Sent" } });

    // Recent notifications
    const notifications = await db.notification.findMany({
      where: { userId, read: false },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Pending approvals (documents where user is an approver)
    const pendingApprovals = await db.signer.findMany({
      where: {
        email: userEmail,
        role: "approver",
        signedAt: null,
        rejectedAt: null,
      },
      include: {
        document: {
          select: { id: true, title: true, status: true },
        },
      },
    });

    return NextResponse.json({
      pending: pendingSigners.map((s) => ({
        id: s.documentId,
        title: s.document.title,
        sender: s.document.owner?.name || s.document.owner?.email || "Unknown",
        status: s.document.status,
        expiresAt: s.document.expiresAt,
        requireOtp: s.document.requireOtp,
        signerToken: s.token,
        role: s.role,
        createdAt: s.document.createdAt,
      })),
      pendingApprovals: pendingApprovals.map((s) => ({
        id: s.documentId,
        title: s.document.title,
        signerToken: s.token,
      })),
      owned: ownedDocs,
      stats: {
        total: totalDocs,
        completed: completedDocs,
        pending: pendingCount,
        sent: sentDocs,
      },
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        documentId: n.documentId,
        createdAt: n.createdAt,
      })),
    });
  } catch (err) {
    console.error("miniapp dashboard error:", err);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
