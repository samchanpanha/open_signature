import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";

const CONNECT_RATE_LIMIT = 5;
const CONNECT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * GET /api/telegram/connect
 * Returns a one-time linking token and a tg:// deep link the user opens in
 * Telegram. The bot's /start <token> handler redeems it (see webhook route).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const rateLimitKey = `telegram-connect:${user.userId}:${ip}`;
    const { allowed, retryAfterMs } = checkRateLimit(rateLimitKey, CONNECT_RATE_LIMIT, CONNECT_WINDOW_MS);

    if (!allowed) {
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Too many requests. Try again in ${retryAfterSeconds} seconds.` },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

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
