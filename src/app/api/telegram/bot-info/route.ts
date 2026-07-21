import { NextRequest, NextResponse } from "next/server";
import { getMe, TelegramError } from "@/lib/telegram";
import { getAuthUser } from "@/lib/permissions";

/**
 * GET /api/telegram/bot-info
 * Returns the bot's username and ID (used by the connect dialog).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const info = await getMe();
    return NextResponse.json(info);
  } catch (err) {
    const e = err as TelegramError;
    return NextResponse.json({ error: e.message || "Bot not configured" }, { status: 500 });
  }
}
