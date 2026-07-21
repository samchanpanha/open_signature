import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/permissions";

/**
 * POST /api/telegram/unlink
 * Disconnects the user's Telegram account.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = user.userId as string;

    await db.user.update({
      where: { id: userId },
      data: { telegramChatId: null, telegramLinkedAt: null },
    });

    // Invalidate active sessions
    await db.telegramSession.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("telegram unlink error:", err);
    return NextResponse.json({ error: "Failed to unlink Telegram" }, { status: 500 });
  }
}
