import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { validateTelegramInitData, isInitDataFresh } from "@/lib/telegram-miniapp";
import { generateToken } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const MINIAPP_AUTH_RATE_LIMIT = 10;
const MINIAPP_AUTH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * POST /api/telegram/miniapp/auth
 * Authenticates a Telegram Mini App user via init data.
 * Creates or links the user, returns a JWT.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const rateLimitKey = `miniapp-auth:${ip}`;
    const { allowed, retryAfterMs } = checkRateLimit(rateLimitKey, MINIAPP_AUTH_RATE_LIMIT, MINIAPP_AUTH_WINDOW_MS);

    if (!allowed) {
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${retryAfterSeconds} seconds.` },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    const { initData } = await req.json();
    if (!initData) {
      return NextResponse.json({ error: "initData is required" }, { status: 400 });
    }

    // Validate init data
    const validated = validateTelegramInitData(initData);
    if (!validated) {
      return NextResponse.json({ error: "Invalid init data" }, { status: 401 });
    }

    // Check freshness (24 hours max)
    if (validated.auth_date && !isInitDataFresh(validated.auth_date, 86400)) {
      return NextResponse.json({ error: "Init data expired" }, { status: 401 });
    }

    const tgUser = validated.user;
    if (!tgUser) {
      return NextResponse.json({ error: "User data not found in init data" }, { status: 400 });
    }

    // Find or create user by Telegram ID
    const chatId = String(tgUser.id);
    let user = await db.user.findFirst({
      where: { telegramChatId: chatId },
    });

    if (!user) {
      // Create a new user from Telegram data
      const email = `tg_${tgUser.id}@opesign.miniapp`;
      const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ") || `User ${tgUser.id}`;

      user = await db.user.create({
        data: {
          email,
          name,
          password: crypto.randomBytes(32).toString("hex"), // Random password, not usable
          telegramChatId: chatId,
          telegramLinkedAt: new Date(),
        },
      });

      // Create default preferences
      await db.userPreferences.create({
        data: { userId: user.id },
      });
    }

    // Track session
    const userAgent = req.headers.get("user-agent") || "MiniApp";

    await db.telegramSession.create({
      data: {
        userId: user.id,
        chatId,
        deviceInfo: userAgent.slice(0, 200),
        ipAddress: ip.slice(0, 50),
      },
    });

    // Generate JWT
    const token = generateToken({ userId: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isSuperAdmin: user.isSuperAdmin,
        telegramChatId: user.telegramChatId,
      },
    });
  } catch (err) {
    console.error("miniapp auth error:", err);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
