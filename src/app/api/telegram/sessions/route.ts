import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/permissions";

/**
 * GET /api/telegram/sessions
 * Returns the user's active Telegram sessions.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = user.userId as string;

    const sessions = await db.telegramSession.findMany({
      where: { userId },
      orderBy: { lastActiveAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ sessions });
  } catch (err) {
    console.error("telegram sessions error:", err);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

/**
 * DELETE /api/telegram/sessions?sessionId=xxx
 * Revokes a specific session.
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = user.userId as string;
    const sessionId = req.nextUrl.searchParams.get("sessionId");

    if (!sessionId) {
      // Revoke all sessions
      await db.telegramSession.updateMany({
        where: { userId },
        data: { isActive: false },
      });
      return NextResponse.json({ success: true });
    }

    // Revoke specific session
    const session = await db.telegramSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    await db.telegramSession.update({
      where: { id: sessionId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("telegram session revoke error:", err);
    return NextResponse.json({ error: "Failed to revoke session" }, { status: 500 });
  }
}
