import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateOtpCode, hashOtp } from "@/lib/auth";
import {
  sendTelegramMessage,
  sendOtpViaTelegram,
  sendDocumentActionMenu,
  answerCallbackQuery,
  editMessageText,
  TelegramError,
  type TelegramMessage,
  type InlineKeyboardButton,
} from "@/lib/telegram";

/**
 * POST /api/telegram/webhook
 *
 * Telegram pushes Updates here. Secured by the `X-Telegram-Bot-Api-Secret-Token`
 * header. Handles:
 *
 * Commands:
 *   /start <token>    - redeem a TelegramBinding or deep link
 *   /start            - welcome message & stats
 *   /help             - show help
 *   /profile          - show user profile
 *   /pending          - show pending signatures with action menu
 *   /completed        - show completed documents
 *   /settings         - show notification settings
 *   /connect          - generate linking token
 *   /disconnect       - unlink Telegram
 *   /otp <token>      - request OTP via Telegram for a document
 *   /approve <token>  - approve a document (approvers only)
 *   /menu <token>     - show action menu for a document
 *   /docs             - show all documents (pending + owned)
 *
 * Callback queries:
 *   otp:<token>       - request OTP via Telegram
 *   review:<token>    - show document review details
 *   approve:<token>   - approve a document
 *   reject:<token>    - reject a document
 *   ack:<token>       - acknowledge signing
 *   open:<token>      - open signing link
 *   menu:<token>      - show action menu
 *   sign:<token>      - show sign confirmation
 *   confirm-sign:<token> - confirm signing via Telegram
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
    return NextResponse.json({ ok: true });
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

// ---------------------------------------------------------------------------
// MESSAGE / COMMAND HANDLER
// ---------------------------------------------------------------------------
async function handleMessage(msg: TelegramMessage) {
  const text = msg.text || "";
  const chatId = String(msg.chat.id);
  const parts = text.split(" ");
  const command = parts[0]?.toLowerCase();
  const arg = parts.slice(1).join(" ").trim();

  // ── /start <token> ───────────────────────────────────────────────────────
  if (command === "/start" && arg) {
    // Deep link prefixes
    if (arg.startsWith("document_")) {
      const docId = arg.replace("document_", "");
      const doc = await db.document.findUnique({
        where: { id: docId },
        select: { id: true, title: true, status: true },
      });
      if (doc) {
        const appUrl = process.env.TELEGRAM_MINI_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        await sendTelegramMessage(
          chatId,
          `📄 *${doc.title}*\nStatus: ${doc.status}\n\nOpen in the app to view or take action.`,
          { reply_markup: { inline_keyboard: [[{ text: "Open Document", url: `${appUrl}?doc=${doc.id}` }]] } }
        );
      } else {
        await sendTelegramMessage(chatId, "❌ Document not found.");
      }
      return;
    }

    if (arg.startsWith("sign_")) {
      const signerToken = arg.replace("sign_", "");
      await handleSignDeepLink(chatId, signerToken);
      return;
    }

    // Default: try to redeem as a binding token
    const binding = await db.telegramBinding.findUnique({ where: { token: arg } });
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

    if (binding.linkedUserId) {
      await db.user.update({
        where: { id: binding.linkedUserId },
        data: { telegramChatId: chatId, telegramLinkedAt: new Date() },
      });
    }

    const name = msg.from?.first_name ?? "there";
    await sendTelegramMessage(
      chatId,
      `✅ Linked, ${name}! You'll now receive document signing notifications here.\n\nType /help to see available commands.`
    );
    return;
  }

  // ── /start without token ──────────────────────────────────────────────────
  if (command === "/start") {
    const user = await db.user.findFirst({ where: { telegramChatId: chatId } });
    if (user) {
      const pending = await db.signer.count({
        where: { email: user.email, signedAt: null, rejectedAt: null },
      });
      const completed = await db.document.count({
        where: { ownerId: user.id, status: "Completed" },
      });
      const buttons: InlineKeyboardButton[][] = [
        [
          { text: "✍️ Pending", callback_data: "cmd:pending" },
          { text: "📄 Documents", callback_data: "cmd:docs" },
        ],
        [
          { text: "👤 Profile", callback_data: "cmd:profile" },
          { text: "⚙️ Settings", callback_data: "cmd:settings" },
        ],
      ];
      await sendTelegramMessage(
        chatId,
        `🏠 *Welcome back, ${user.name.split(" ")[0]}!*\n\n` +
        `📊 *Your Stats*\n` +
        `• ${pending} pending signature${pending === 1 ? "" : "s"}\n` +
        `• ${completed} completed document${completed === 1 ? "" : "s"}\n\n` +
        `Type /help to see all commands.`,
        { reply_markup: { inline_keyboard: buttons } }
      );
    } else {
      await sendTelegramMessage(
        chatId,
        "👋 *Welcome to OpenSign!*\n\n" +
        "Link your account from the web app to receive signing notifications.\n\n" +
        "Type /help to see available commands."
      );
    }
    return;
  }

  // ── /help ─────────────────────────────────────────────────────────────────
  if (command === "/help") {
    await sendTelegramMessage(
      chatId,
      "📄 *OpenSign Bot Commands*\n\n" +
        "🏠 /start - Welcome & stats\n" +
        "❓ /help - Show this help\n" +
        "👤 /profile - View your profile\n" +
        "✍️ /pending - Pending signatures\n" +
        "📄 /completed - Completed documents\n" +
        "📑 /docs - All your documents\n" +
        "🔐 /otp <token> - Request OTP via Telegram\n" +
        "📋 /menu <token> - Document action menu\n" +
        "✅ /approve <token> - Approve a document\n" +
        "⚙️ /settings - Notification settings\n" +
        "🔗 /connect - Link your Telegram\n" +
        "🔌 /disconnect - Unlink Telegram\n\n" +
        "_You'll also receive notifications when documents are assigned to you._"
    );
    return;
  }

  // ── /profile ──────────────────────────────────────────────────────────────
  if (command === "/profile") {
    const user = await db.user.findFirst({ where: { telegramChatId: chatId } });
    if (!user) {
      await sendTelegramMessage(chatId, "❌ Your Telegram account is not linked. Use /connect to link it.");
      return;
    }
    const docCount = await db.document.count({ where: { ownerId: user.id } });
    const pendingCount = await db.signer.count({
      where: { email: user.email, signedAt: null, rejectedAt: null },
    });
    await sendTelegramMessage(
      chatId,
      `👤 *Your Profile*\n\n` +
        `*Name:* ${user.name}\n` +
        `*Email:* ${user.email}\n` +
        `*Linked:* ${user.telegramLinkedAt ? new Date(user.telegramLinkedAt).toLocaleDateString() : "N/A"}\n` +
        `*Documents:* ${docCount}\n` +
        `*Pending:* ${pendingCount}`
    );
    return;
  }

  // ── /pending ──────────────────────────────────────────────────────────────
  if (command === "/pending") {
    const user = await db.user.findFirst({ where: { telegramChatId: chatId } });
    if (!user) {
      await sendTelegramMessage(chatId, "❌ Your Telegram account is not linked. Use /connect to link it.");
      return;
    }
    const pending = await db.signer.findMany({
      where: { email: user.email, signedAt: null, rejectedAt: null },
      include: { document: { select: { id: true, title: true, expiresAt: true, requireOtp: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    if (pending.length === 0) {
      await sendTelegramMessage(chatId, "✅ No pending signatures. You're all caught up!");
      return;
    }

    // Send each document with full action menu
    for (const s of pending) {
      await sendDocumentActionMenu(
        chatId,
        s.token,
        s.document.title,
        s.role,
        s.document.expiresAt
      );
    }
    return;
  }

  // ── /completed ────────────────────────────────────────────────────────────
  if (command === "/completed") {
    const user = await db.user.findFirst({ where: { telegramChatId: chatId } });
    if (!user) {
      await sendTelegramMessage(chatId, "❌ Your Telegram account is not linked. Use /connect to link it.");
      return;
    }
    const completed = await db.document.findMany({
      where: { ownerId: user.id, status: "Completed" },
      select: { id: true, title: true, createdAt: true, signedPdfPath: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    if (completed.length === 0) {
      await sendTelegramMessage(chatId, "📭 No completed documents yet.");
      return;
    }

    await sendTelegramMessage(
      chatId,
      `✅ *Completed Documents (${completed.length})*\n\n` +
        completed
          .map(
            (d, i) =>
              `${i + 1}. *${d.title}*\n` +
              `   Completed: ${new Date(d.createdAt).toLocaleDateString()}${d.signedPdfPath ? " | 📥 Signed PDF available" : ""}`
          )
          .join("\n\n")
    );
    return;
  }

  // ── /docs ─────────────────────────────────────────────────────────────────
  if (command === "/docs") {
    const user = await db.user.findFirst({ where: { telegramChatId: chatId } });
    if (!user) {
      await sendTelegramMessage(chatId, "❌ Your Telegram account is not linked. Use /connect to link it.");
      return;
    }

    const pendingSigners = await db.signer.findMany({
      where: { email: user.email, signedAt: null, rejectedAt: null },
      include: { document: { select: { id: true, title: true, status: true } } },
      take: 5,
    });

    const ownedDocs = await db.document.findMany({
      where: { ownerId: user.id, status: { not: "Completed" } },
      select: { id: true, title: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const allDocs = [
      ...pendingSigners.map((s) => ({
        title: s.document.title,
        status: s.document.status,
        action: "sign",
        token: s.token,
      })),
      ...ownedDocs.map((d) => ({
        title: d.title,
        status: d.status,
        action: "view",
        token: d.id,
      })),
    ];

    if (allDocs.length === 0) {
      await sendTelegramMessage(chatId, "📭 No documents found.");
      return;
    }

    const buttons: InlineKeyboardButton[][] = allDocs.map((d) => [
      {
        text: `${d.action === "sign" ? "✍️" : "📄"} ${d.title.slice(0, 35)} [${d.status}]`,
        callback_data: `menu:${d.token}`,
      },
    ]);

    await sendTelegramMessage(
      chatId,
      `📑 *Your Documents*\n\n` +
        allDocs
          .map((d, i) => `${i + 1}. *${d.title}* — ${d.status}`)
          .join("\n"),
      { reply_markup: { inline_keyboard: buttons } }
    );
    return;
  }

  // ── /otp <signerToken> ────────────────────────────────────────────────────
  if (command === "/otp" && arg) {
    await handleOtpRequest(chatId, arg);
    return;
  }

  if (command === "/otp" && !arg) {
    await sendTelegramMessage(
      chatId,
      "🔐 *Request OTP via Telegram*\n\n" +
      "Usage: `/otp <signer_token>`\n\n" +
      "The signer token is found in the signing link or notification message.",
      { parse_mode: "Markdown" }
    );
    return;
  }

  // ── /menu <signerToken> ───────────────────────────────────────────────────
  if (command === "/menu" && arg) {
    await handleDocumentMenu(chatId, arg);
    return;
  }

  if (command === "/menu" && !arg) {
    await sendTelegramMessage(
      chatId,
      "📋 *Document Action Menu*\n\n" +
      "Usage: `/menu <signer_token>`\n\n" +
      "Shows all available actions for a document.",
      { parse_mode: "Markdown" }
    );
    return;
  }

  // ── /approve <signerToken> ────────────────────────────────────────────────
  if (command === "/approve" && arg) {
    await handleApprove(chatId, arg);
    return;
  }

  // ── /settings ─────────────────────────────────────────────────────────────
  if (command === "/settings") {
    const user = await db.user.findFirst({ where: { telegramChatId: chatId } });
    if (!user) {
      await sendTelegramMessage(chatId, "❌ Your Telegram account is not linked. Use /connect to link it.");
      return;
    }
    const prefs = await db.userPreferences.findUnique({ where: { userId: user.id } });
    await sendTelegramMessage(
      chatId,
      `⚙️ *Notification Settings*\n\n` +
        `• Document Sent: ${prefs?.telegramOnSent !== false ? "✅" : "❌"}\n` +
        `• Document Completed: ${prefs?.telegramOnCompleted !== false ? "✅" : "❌"}\n` +
        `• Document Rejected: ${prefs?.telegramOnRejected !== false ? "✅" : "❌"}\n` +
        `• Expiring Soon: ${prefs?.telegramOnExpiring !== false ? "✅" : "❌"}\n` +
        `• Reminders: ${prefs?.telegramOnReminder !== false ? "✅" : "❌"}\n` +
        `• Approval Requests: ${prefs?.telegramOnApproval !== false ? "✅" : "❌"}\n` +
        `• Daily Summary: ${prefs?.telegramDailySummary ? "✅" : "❌"}\n` +
        `• Weekly Summary: ${prefs?.telegramWeeklySummary ? "✅" : "❌"}\n` +
        `• Security Alerts: ${prefs?.telegramSecurityAlerts !== false ? "✅" : "❌"}\n\n` +
        `_Manage these in the web app settings._`
    );
    return;
  }

  // ── /connect ──────────────────────────────────────────────────────────────
  if (command === "/connect") {
    const user = await db.user.findFirst({ where: { telegramChatId: chatId } });
    if (user) {
      await sendTelegramMessage(chatId, "✅ Your Telegram account is already linked! Use /disconnect to unlink first.");
      return;
    }
    await sendTelegramMessage(
      chatId,
      "🔗 *Link Your Account*\n\n" +
        "To link your OpenSign account:\n" +
        "1. Open the web app\n" +
        "2. Click the Telegram icon in the header\n" +
        "3. Follow the instructions\n\n" +
        "Or visit the web app directly to generate a linking code."
    );
    return;
  }

  // ── /disconnect ───────────────────────────────────────────────────────────
  if (command === "/disconnect") {
    const user = await db.user.findFirst({ where: { telegramChatId: chatId } });
    if (!user) {
      await sendTelegramMessage(chatId, "❌ Your Telegram account is not linked.");
      return;
    }
    await db.user.update({
      where: { id: user.id },
      data: { telegramChatId: null, telegramLinkedAt: null },
    });
    await sendTelegramMessage(
      chatId,
      "🔌 Your Telegram account has been unlinked. You will no longer receive notifications here.\n\nUse /connect to link again."
    );
    return;
  }

  // ── Unknown command ───────────────────────────────────────────────────────
  await sendTelegramMessage(
    chatId,
    "❓ Unknown command. Type /help to see available commands."
  );
}

// ---------------------------------------------------------------------------
// CALLBACK QUERY HANDLER
// ---------------------------------------------------------------------------
async function handleCallback(cb: any) {
  const data: string = cb.data || "";
  const chatId = String(cb.message?.chat?.id ?? cb.from?.id);
  const callbackQueryId = cb.id as string;
  const messageId = cb.message?.message_id as number | undefined;

  // ── otp:<signerToken> ─────────────────────────────────────────────────────
  if (data.startsWith("otp:")) {
    const signerToken = data.slice(4);
    await handleOtpRequest(chatId, signerToken);
    await answerCallbackQuery(callbackQueryId, "🔐 OTP requested");
    return;
  }

  // ── review:<signerToken> ──────────────────────────────────────────────────
  if (data.startsWith("review:")) {
    const signerToken = data.slice(7);
    await handleReview(chatId, signerToken);
    await answerCallbackQuery(callbackQueryId, "👁 Reviewing document");
    return;
  }

  // ── approve:<signerToken> ─────────────────────────────────────────────────
  if (data.startsWith("approve:")) {
    const signerToken = data.slice(8);
    await handleApprove(chatId, signerToken);
    await answerCallbackQuery(callbackQueryId, "✅ Processing approval");
    return;
  }

  // ── reject:<signerToken> ──────────────────────────────────────────────────
  if (data.startsWith("reject:")) {
    const signerToken = data.slice(7);
    await handleReject(chatId, signerToken, callbackQueryId);
    return;
  }

  // ── ack:<signerToken> ─────────────────────────────────────────────────────
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

  // ── open:<signerToken> ────────────────────────────────────────────────────
  if (data.startsWith("open:")) {
    await answerCallbackQuery(callbackQueryId);
    return;
  }

  // ── menu:<signerToken> ────────────────────────────────────────────────────
  if (data.startsWith("menu:")) {
    const signerToken = data.slice(5);
    await handleDocumentMenu(chatId, signerToken);
    await answerCallbackQuery(callbackQueryId, "📋 Action menu");
    return;
  }

  // ── sign:<signerToken> ────────────────────────────────────────────────────
  if (data.startsWith("sign:")) {
    const signerToken = data.slice(5);
    const appUrl = process.env.TELEGRAM_MINI_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    await sendTelegramMessage(
      chatId,
      "📥 Opening signing page...",
      { reply_markup: { inline_keyboard: [[{ text: "✍️ Open Signing Page", url: `${appUrl}/sign/${signerToken}` }]] } }
    );
    await answerCallbackQuery(callbackQueryId);
    return;
  }

  // ── confirm-sign:<signerToken> ────────────────────────────────────────────
  if (data.startsWith("confirm-sign:")) {
    const signerToken = data.slice(13);
    const appUrl = process.env.TELEGRAM_MINI_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    await sendTelegramMessage(
      chatId,
      "📥 Opening signing page to complete...",
      { reply_markup: { inline_keyboard: [[{ text: "✍️ Complete Signing", url: `${appUrl}/sign/${signerToken}` }]] } }
    );
    await answerCallbackQuery(callbackQueryId);
    return;
  }

  // ── cmd:<command> ─────────────────────────────────────────────────────────
  if (data.startsWith("cmd:")) {
    const cmd = data.slice(4);
    await answerCallbackQuery(callbackQueryId);
    // Simulate a command
    await handleMessage({ text: `/${cmd}`, chat: { id: Number(chatId), type: "private" } } as TelegramMessage);
    return;
  }

  await answerCallbackQuery(callbackQueryId, "Unknown action.");
}

// ---------------------------------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------------------------------

async function handleSignDeepLink(chatId: string, signerToken: string) {
  const signer = await db.signer.findUnique({
    where: { token: signerToken },
    include: { document: { select: { id: true, title: true, status: true, expiresAt: true, requireOtp: true } } },
  });

  if (signer && !signer.signedAt) {
    // Send full action menu
    await sendDocumentActionMenu(chatId, signerToken, signer.document.title, signer.role, signer.document.expiresAt);
  } else if (signer?.signedAt) {
    await sendTelegramMessage(chatId, "✅ This document has already been signed.");
  } else {
    await sendTelegramMessage(chatId, "❌ Invalid signing link.");
  }
}

async function handleOtpRequest(chatId: string, signerToken: string) {
  const signer = await db.signer.findUnique({
    where: { token: signerToken },
    include: { document: { select: { title: true, requireOtp: true } } },
  });

  if (!signer) {
    await sendTelegramMessage(chatId, "❌ Invalid signing link. Document not found.");
    return;
  }

  if (signer.signedAt) {
    await sendTelegramMessage(chatId, "✅ This document has already been signed. No OTP needed.");
    return;
  }

  if (signer.otpVerifiedAt) {
    await sendTelegramMessage(chatId, "✅ OTP already verified for this document. You can proceed to sign.");
    return;
  }

  // Check rate limiting (simple: max 3 per 5 min per token)
  if (signer.otpRequestedAt) {
    const timeSince = Date.now() - new Date(signer.otpRequestedAt).getTime();
    const fiveMinMs = 5 * 60 * 1000;
    if (timeSince < fiveMinMs && signer.otpCode) {
      await sendTelegramMessage(
        chatId,
        `⏰ Please wait ${Math.ceil((fiveMinMs - timeSince) / 60000)} minute(s) before requesting a new OTP.`
      );
      return;
    }
  }

  // Generate and send OTP
  const code = generateOtpCode();
  const hashedCode = hashOtp(code);

  await db.signer.update({
    where: { id: signer.id },
    data: {
      otpCode: hashedCode,
      otpRequestedAt: new Date(),
      otpMethod: "telegram",
    },
  });

  try {
    await sendOtpViaTelegram(chatId, code, signer.document.title);
  } catch (err) {
    const e = err as TelegramError;
    console.error("[OTP] Telegram send failed:", e.message);
    await sendTelegramMessage(chatId, "❌ Failed to send OTP. Please try again or use email/SMS.");
    return;
  }

  // Log
  const user = await db.user.findFirst({ where: { telegramChatId: chatId } });
  if (user) {
    await db.telegramMessageLog.create({
      data: {
        userId: user.id,
        chatId,
        messageType: "otp",
        content: `OTP sent for document: ${signer.document.title}`,
        status: "sent",
      },
    });
  }

  await db.auditLog.create({
    data: {
      action: "OTP_REQUESTED",
      documentId: signer.documentId,
      signerId: signer.id,
      details: `OTP code requested via Telegram for signer ${signer.name} (${signer.email})`,
      ipAddress: "telegram",
    },
  });

  await sendTelegramMessage(
    chatId,
    `🔐 *OTP sent!*\n\nCheck the message above for your verification code.\n` +
    `Enter it on the signing page to verify your identity.\n\n` +
    `_The code expires in 10 minutes._`,
    { parse_mode: "Markdown" }
  );
}

async function handleReview(chatId: string, signerToken: string) {
  const signer = await db.signer.findUnique({
    where: { token: signerToken },
    include: {
      document: {
        select: {
          id: true, title: true, status: true, createdAt: true,
          expiresAt: true, requireOtp: true,
        },
      },
      fields: {
        select: { id: true, type: true, label: true, value: true, required: true },
      },
    },
  });

  if (!signer) {
    await sendTelegramMessage(chatId, "❌ Document not found.");
    return;
  }

  const appUrl = process.env.TELEGRAM_MINI_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const statusEmoji = signer.signedAt ? "✅" : signer.rejectedAt ? "❌" : "⏳";

  let fieldList = "";
  if (signer.fields.length > 0) {
    fieldList = "\n📝 *Fields:*\n" + signer.fields
      .map((f) => `  • ${f.label || f.type}${f.required ? " (required)" : ""}: ${f.value || "not filled"}`)
      .join("\n");
  }

  const buttons: InlineKeyboardButton[][] = [
    [{ text: "📥 Open Document", url: `${appUrl}/sign/${signerToken}` }],
    [{ text: "📋 Action Menu", callback_data: `menu:${signerToken}` }],
  ];

  await sendTelegramMessage(
    chatId,
    `👁 *Document Review*\n\n` +
    `📄 *${signer.document.title}*\n` +
    `📊 Status: ${statusEmoji} ${signer.document.status}\n` +
    `👤 Your role: ${signer.role}\n` +
    `🔐 OTP required: ${signer.document.requireOtp ? "Yes" : "No"}\n` +
    `📅 Created: ${new Date(signer.document.createdAt).toLocaleDateString()}` +
    (signer.document.expiresAt
      ? `\n⏰ Expires: ${new Date(signer.document.expiresAt).toLocaleDateString()}`
      : "") +
    fieldList + "\n\n" +
    `${signer.signedAt ? "✅ You have already signed this document." : "⏳ Awaiting your signature."}`,
    { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } }
  );
}

async function handleApprove(chatId: string, signerToken: string) {
  const signer = await db.signer.findUnique({
    where: { token: signerToken },
    include: { document: { select: { id: true, title: true, ownerId: true, status: true } } },
  });

  if (!signer) {
    await sendTelegramMessage(chatId, "❌ Document not found.");
    return;
  }

  if (signer.role !== "approver") {
    await sendTelegramMessage(chatId, "❌ You are not assigned as an approver for this document.");
    return;
  }

  if (signer.signedAt) {
    await sendTelegramMessage(chatId, "✅ You have already approved this document.");
    return;
  }

  if (signer.rejectedAt) {
    await sendTelegramMessage(chatId, "❌ This document was already rejected. Contact the document owner.");
    return;
  }

  // Mark as signed (approval = signed)
  await db.signer.update({
    where: { id: signer.id },
    data: { signedAt: new Date() },
  });

  // Audit log
  await db.auditLog.create({
    data: {
      action: "SIGNER_COMPLETED",
      documentId: signer.documentId,
      signerId: signer.id,
      details: `Signer ${signer.name} (${signer.email}) approved via Telegram`,
      ipAddress: "telegram",
    },
  });

  // In-app notification
  await db.notification.create({
    data: {
      type: "approval",
      title: "Document Approved",
      message: `${signer.name} approved "${signer.document.title}" via Telegram`,
      userId: signer.document.ownerId,
      documentId: signer.documentId,
    },
  });

  // Check if all signers have signed
  const allSigners = await db.signer.findMany({
    where: { documentId: signer.documentId },
  });
  const allSigned = allSigners.every((s) => s.signedAt !== null);

  if (allSigned) {
    await db.document.update({
      where: { id: signer.documentId },
      data: { status: "Completed" },
    });
    await sendTelegramMessage(
      chatId,
      `✅ *Approval recorded!*\n\n"${signer.document.title}" is now fully approved by all parties.`,
      { parse_mode: "Markdown" }
    );
  } else {
    const remaining = allSigners.filter((s) => !s.signedAt).length;
    await sendTelegramMessage(
      chatId,
      `✅ *Approval recorded!*\n\n"${signer.document.title}" — ${remaining} signer(s) remaining.`,
      { parse_mode: "Markdown" }
    );
  }
}

async function handleReject(chatId: string, signerToken: string, callbackQueryId?: string) {
  const signer = await db.signer.findUnique({
    where: { token: signerToken },
    include: { document: { select: { id: true, title: true, ownerId: true } } },
  });

  if (!signer) {
    if (callbackQueryId) await answerCallbackQuery(callbackQueryId, "Document not found.");
    return;
  }

  if (signer.signedAt) {
    await sendTelegramMessage(chatId, "✅ Already signed/approved. Cannot reject.");
    if (callbackQueryId) await answerCallbackQuery(callbackQueryId, "Already signed.");
    return;
  }

  if (signer.rejectedAt) {
    await sendTelegramMessage(chatId, "❌ Already rejected.");
    if (callbackQueryId) await answerCallbackQuery(callbackQueryId, "Already rejected.");
    return;
  }

  // Mark as rejected
  await db.signer.update({
    where: { id: signer.id },
    data: { rejectedAt: new Date(), rejectionReason: "Rejected via Telegram" },
  });

  // Update document status
  await db.document.update({
    where: { id: signer.documentId },
    data: { status: "Rejected" },
  });

  // Audit log
  await db.auditLog.create({
    data: {
      action: "SIGNER_REJECTED",
      documentId: signer.documentId,
      signerId: signer.id,
      details: `Signer ${signer.name} (${signer.email}) rejected via Telegram`,
      ipAddress: "telegram",
    },
  });

  // Notify document owner
  await db.notification.create({
    data: {
      type: "rejection",
      title: "Document Rejected",
      message: `${signer.name} rejected "${signer.document.title}" via Telegram`,
      userId: signer.document.ownerId,
      documentId: signer.documentId,
    },
  });

  // Find the owner's Telegram chat and notify them
  const owner = await db.user.findUnique({
    where: { id: signer.document.ownerId },
    select: { telegramChatId: true, name: true },
  });

  if (owner?.telegramChatId) {
    const buttons: InlineKeyboardButton[][] = [
      [{ text: "📄 View Document", callback_data: `document_${signer.documentId}` }],
    ];
    await sendTelegramMessage(
      owner.telegramChatId,
      `❌ *Document Rejected*\n\n` +
      `"${signer.document.title}" was rejected by *${signer.name}*.\n\n` +
      `_Reason: Rejected via Telegram_`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } }
    );
  }

  await sendTelegramMessage(chatId, `❌ Rejection recorded for "${signer.document.title}".`);
  if (callbackQueryId) await answerCallbackQuery(callbackQueryId, "❌ Rejection recorded");
}

async function handleDocumentMenu(chatId: string, signerToken: string) {
  const signer = await db.signer.findUnique({
    where: { token: signerToken },
    include: { document: { select: { id: true, title: true, expiresAt: true, requireOtp: true } } },
  });

  if (!signer) {
    await sendTelegramMessage(chatId, "❌ Document not found.");
    return;
  }

  await sendDocumentActionMenu(chatId, signerToken, signer.document.title, signer.role, signer.document.expiresAt);
}
