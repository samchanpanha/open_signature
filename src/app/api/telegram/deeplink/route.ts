import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/telegram/deeplink?type=document&id=xxx
 * Generates a Telegram deep link for sharing documents/approvals.
 * Returns a t.me/ URL that opens the bot with the appropriate start parameter.
 */
export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get("type");
    const id = req.nextUrl.searchParams.get("id");
    const bot = process.env.TELEGRAM_BOT_USERNAME;

    if (!bot) {
      return NextResponse.json({ error: "TELEGRAM_BOT_USERNAME not set" }, { status: 500 });
    }

    if (!type || !id) {
      return NextResponse.json({ error: "type and id required" }, { status: 400 });
    }

    let deepLink = "";

    switch (type) {
      case "document": {
        // Generate a share link for a document
        const doc = await db.document.findUnique({
          where: { id },
          select: { id: true, title: true, status: true },
        });
        if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
        deepLink = `https://t.me/${bot}?start=document_${doc.id}`;
        break;
      }
      case "approval": {
        // Generate a share link for an approval
        const signer = await db.signer.findUnique({
          where: { id },
          select: { id: true, token: true, document: { select: { title: true } } },
        });
        if (!signer) return NextResponse.json({ error: "Signer not found" }, { status: 404 });
        deepLink = `https://t.me/${bot}?start=sign_${signer.token}`;
        break;
      }
      case "sign": {
        // Generate a direct signing link
        const signer = await db.signer.findUnique({
          where: { token: id },
          select: { token: true, document: { select: { title: true } } },
        });
        if (!signer) return NextResponse.json({ error: "Invalid signing token" }, { status: 404 });
        deepLink = `https://t.me/${bot}?start=sign_${signer.token}`;
        break;
      }
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    return NextResponse.json({ deepLink, bot });
  } catch (err) {
    console.error("deeplink error:", err);
    return NextResponse.json({ error: "Failed to generate deep link" }, { status: 500 });
  }
}
