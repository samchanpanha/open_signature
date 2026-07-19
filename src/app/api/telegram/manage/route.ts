import { NextRequest, NextResponse } from "next/server";
import { setWebhook, deleteWebhook, TelegramError } from "@/lib/telegram";

/**
 * POST /api/telegram/manage  { action: "set" | "delete" }
 * Protected by CRON_SECRET (reuse the same ops secret). Use this from your
 * deploy pipeline / CI to (re)register the webhook after deploys.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { action } = await req.json();
    if (action === "delete") {
      await deleteWebhook();
      return NextResponse.json({ success: true, action: "delete" });
    }
    const url = process.env.TELEGRAM_WEBHOOK_URL;
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!url || !secretToken) {
      return NextResponse.json({ error: "TELEGRAM_WEBHOOK_URL / TELEGRAM_WEBHOOK_SECRET not set" }, { status: 400 });
    }
    const res = await setWebhook(url, secretToken);
    return NextResponse.json({ success: true, action: "set", res });
  } catch (err) {
    const e = err as TelegramError;
    return NextResponse.json({ error: e.message, detail: e.body }, { status: 502 });
  }
}
