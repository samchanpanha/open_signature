import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/permissions";

/**
 * GET /api/telegram/stats
 * Returns Telegram integration statistics (admin only).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const totalLinked = await db.user.count({
      where: { telegramChatId: { not: null } },
    });

    const messagesSent = await db.telegramMessageLog.count({
      where: { status: "sent" },
    });

    const messagesFailed = await db.telegramMessageLog.count({
      where: { status: "failed" },
    });

    const activeSessions = await db.telegramSession.count({
      where: { isActive: true },
    });

    return NextResponse.json({
      totalLinked,
      messagesSent,
      messagesFailed,
      activeSessions,
    });
  } catch (err) {
    console.error("telegram stats error:", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
