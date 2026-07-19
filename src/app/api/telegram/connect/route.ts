import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/permissions";
import crypto from "crypto";

/**
 * GET /api/telegram/connect
 * Returns a one-time linking token and a tg:// deep link the user opens in
 * Telegram. The bot's /start <token> handler redeems it (see webhook route).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // If already linked, return the existing chat handle (no new token needed).
    const existing = await db.user.findUnique({
      where: { id: user.userId as string },
      select: { telegramChatId: true },
    });
    if (existing?.telegramChatId) {
      return NextResponse.json({ linked: true, chatId: existing.telegramChatId });
    }

    const token = crypto.randomBytes(24).toString("hex");
    await db.telegramBinding.create({ data: { token, chatId: "" } });

    const bot = process.env.TELEGRAM_BOT_USERNAME;
    if (!bot) return NextResponse.json({ error: "TELEGRAM_BOT_USERNAME not set" }, { status: 500 });

    return NextResponse.json({
      linked: false,
      token,
      deepLink: `https://t.me/${bot}?start=${token}`,
    });
  } catch (err) {
    console.error("telegram connect error:", err);
    return NextResponse.json({ error: "Failed to start Telegram linking" }, { status: 500 });
  }
}
