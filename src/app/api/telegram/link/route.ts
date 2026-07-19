import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/telegram/link?token=xxx
 * Called by the SPA after the user pastes confirmation, or simply to check
 * whether a previously issued token has been redeemed by the bot.
 * Returns { linked: boolean }.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

    const binding = await db.telegramBinding.findUnique({ where: { token } });
    if (!binding) return NextResponse.json({ error: "Invalid token" }, { status: 404 });

    return NextResponse.json({
      linked: !!binding.consumedAt,
      chatId: binding.consumedAt ? binding.chatId : null,
    });
  } catch (err) {
    console.error("telegram link check error:", err);
    return NextResponse.json({ error: "Failed to check link" }, { status: 500 });
  }
}
