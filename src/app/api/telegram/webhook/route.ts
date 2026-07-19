import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  sendTelegramMessage,
  answerCallbackQuery,
  TelegramError,
  type TelegramMessage,
} from "@/lib/telegram";

/**
 * POST /api/telegram/webhook
 *
 * Telegram pushes Updates here. Secured by the `X-Telegram-Bot-Api-Secret-Token`
 * header (secret_token set via setWebhook). We handle:
 *   - message with /start <token>  -> redeem a TelegramBinding, link to User
 *   - callback_query with callback_data -> signer actions (ack / open)
 *
 * Note: Telegram sends one Update per HTTP request (no batching), so this is
 * safe to process synchronously. Wrap in try/catch and ALWAYS return 200 so
 * Telegram does not retry forever.
 */
export async function POST(req: NextRequest) {
  // 1. Validate secret header (Bot API 6.2+ payload authentication)
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!secret || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true }); // ignore malformed
  }

  try {
    if (update.message?.text) {
      await handleMessage(update.message as TelegramMessage);
    } else if (update.callback_query) {
      await handleCallback(update.callback_query);
    }
  } catch (err) {
    console.error("telegram webhook processing error:", err);
  }

  return NextResponse.json({ ok: true });
}

async function handleMessage(msg: TelegramMessage) {
  const text = msg.text || "";
  const chatId = String(msg.chat.id);

  if (text.startsWith("/start")) {
    const token = text.split(" ")[1]?.trim();
    if (!token) {
      await sendTelegramMessage(chatId, "👋 Hi! Link your account from the web app to receive signing notifications.");
      return;
    }
    const binding = await db.telegramBinding.findUnique({ where: { token } });
    if (!binding) {
      await sendTelegramMessage(chatId, "❌ This link code is invalid or expired. Generate a new one in the web app.");
      return;
    }
    await db.telegramBinding.update({
      where: { id: binding.id },
      data: {
        chatId,
        username: msg.from?.username ?? null,
        firstName: msg.from?.first_name ?? null,
        consumedAt: new Date(),
        linkedUserId: binding.linkedUserId ?? null,
      },
    });

    // If the token was generated while logged in (linkedUserId set at connect),
    // persist the chat id straight onto the user.
    if (binding.linkedUserId) {
      await db.user.update({
        where: { id: binding.linkedUserId },
        data: { telegramChatId: chatId, telegramLinkedAt: new Date() },
      });
    }

    const name = msg.from?.first_name ?? "there";
    await sendTelegramMessage(
      chatId,
      `✅ Linked, ${name}! You'll now receive document signing notifications here.`
    );
    return;
  }

  if (text === "/help" || text === "/start") {
    await sendTelegramMessage(
      chatId,
      "📄 *OpenSign Bot*\nYou'll get a message when a document is assigned to you. Tap *Sign Document* to open it, or *Acknowledge* to confirm receipt."
    );
  }
}

async function handleCallback(cb: any) {
  const data: string = cb.data || "";
  const chatId = String(cb.message?.chat?.id ?? cb.from?.id);
  const callbackQueryId = cb.id as string;

  // callback_data format: "ack:<signerToken>" or "open:<signerToken>"
  if (data.startsWith("ack:")) {
    const signerToken = data.slice(4);
    const signer = await db.signer.findUnique({
      where: { token: signerToken },
      include: { document: { select: { title: true, ownerId: true } } },
    });
    if (!signer) {
      await answerCallbackQuery(callbackQueryId, "Document not found.");
      return;
    }
    await db.auditLog.create({
      data: {
        action: "TELEGRAM_ACK",
        documentId: signer.documentId,
        signerId: signer.id,
        details: `Signer ${signer.name} acknowledged via Telegram`,
        ipAddress: "telegram",
      },
    });
    await db.notification.create({
      data: {
        type: "telegram_ack",
        title: "Signing acknowledged",
        message: `${signer.name} acknowledged "${signer.document.title}" via Telegram`,
        userId: signer.document.ownerId,
        documentId: signer.documentId,
      },
    });
    await answerCallbackQuery(callbackQueryId, "✅ Acknowledged");
    return;
  }

  if (data.startsWith("open:")) {
    await answerCallbackQuery(callbackQueryId);
    // The signer opens the app via the button URL; nothing to persist server-side.
    return;
  }

  await answerCallbackQuery(callbackQueryId, "Unknown action.");
}
