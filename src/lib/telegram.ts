/**
 * Telegram Bot integration for document-signing notifications.
 *
 * Wraps the Telegram Bot API (sendMessage / answerCallbackQuery / setWebhook /
 * deleteWebhook) and validates inbound webhook payloads using the
 * secret-token header (Bot API 6.2+). All calls go over HTTPS to api.telegram.org.
 *
 * Docs: https://core.telegram.org/bots/api
 */

const TELEGRAM_API = "https://api.telegram.org";

export class TelegramError extends Error {
  constructor(message: string, public status?: number, public body?: unknown) {
    super(message);
    this.name = "TelegramError";
  }
}

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new TelegramError("TELEGRAM_BOT_TOKEN is not configured");
  return token;
}

async function api<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  const url = `${TELEGRAM_API}/bot${botToken()}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => null)) as
    | { ok: true; result: T }
    | { ok: false; description: string; error_code: number };

  if (!res.ok || !data || !data.ok) {
    throw new TelegramError(
      (data && "description" in data ? data.description : `Telegram ${method} failed`),
      res.status,
      data
    );
  }
  return data.result;
}

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface TelegramMessage {
  message_id: number;
  chat: { id: number; type: string; username?: string; first_name?: string; last_name?: string };
  from?: { id: number; username?: string; first_name?: string; last_name?: string };
  text?: string;
  callback_query?: unknown;
}

/** Send a message. `reply_markup` carries inline buttons (URL or callback_data). */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options?: {
    parse_mode?: "Markdown" | "MarkdownV2" | "HTML";
    reply_markup?: { inline_keyboard: InlineKeyboardButton[][] };
    disable_web_page_preview?: boolean;
  }
): Promise<TelegramMessage> {
  return api<TelegramMessage>("sendMessage", {
    chat_id: chatId,
    text,
    ...options,
  });
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<unknown> {
  return api("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}

export async function setWebhook(url: string, secretToken: string): Promise<unknown> {
  return api("setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
}

export async function deleteWebhook(): Promise<unknown> {
  return api("deleteWebhook", { drop_pending_updates: true });
}

export async function getMe(): Promise<{ username: string; id: number }> {
  return api("getMe", {});
}

export async function deleteMessage(chatId: string | number, messageId: number): Promise<boolean> {
  try {
    await api("deleteMessage", { chat_id: chatId, message_id: messageId });
    return true;
  } catch {
    return false;
  }
}

export async function editMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  options?: {
    parse_mode?: "Markdown" | "MarkdownV2" | "HTML";
    reply_markup?: { inline_keyboard: InlineKeyboardButton[][] };
    disable_web_page_preview?: boolean;
  }
): Promise<TelegramMessage> {
  return api<TelegramMessage>("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    ...options,
  });
}

export async function sendOtpViaTelegram(
  chatId: string | number,
  code: string,
  documentTitle: string
): Promise<TelegramMessage> {
  return sendTelegramMessage(
    chatId,
    `🔐 *Verification Code*\n\n` +
    `Your OTP for *${documentTitle}* is:\n\n` +
    `\`${code}\`\n\n` +
    `⏰ Expires in 10 minutes.\n` +
    `_Do not share this code with anyone._`,
    { parse_mode: "Markdown" }
  );
}

export async function sendDocumentActionMenu(
  chatId: string | number,
  signerToken: string,
  documentTitle: string,
  role: string,
  expiresAt?: Date | null
): Promise<TelegramMessage> {
  const appUrl = process.env.TELEGRAM_MINI_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const expiryLine = expiresAt ? `\n⏰ Expires: ${new Date(expiresAt).toLocaleDateString()}` : "";

  let buttons: InlineKeyboardButton[][];

  if (role === "approver") {
    buttons = [
      [
        { text: "👁 Review", callback_data: `review:${signerToken}` },
        { text: "📥 Sign", url: `${appUrl}/sign/${signerToken}` },
      ],
      [
        { text: "✅ Approve", callback_data: `approve:${signerToken}` },
        { text: "❌ Reject", callback_data: `reject:${signerToken}` },
      ],
      [{ text: "🔐 Request OTP", callback_data: `otp:${signerToken}` }],
    ];
  } else if (role === "viewer") {
    buttons = [
      [
        { text: "👁 Review", callback_data: `review:${signerToken}` },
        { text: "📥 Open", url: `${appUrl}/sign/${signerToken}` },
      ],
    ];
  } else {
    buttons = [
      [
        { text: "👁 Review", callback_data: `review:${signerToken}` },
        { text: "📥 Sign Now", url: `${appUrl}/sign/${signerToken}` },
      ],
      [
        { text: "🔐 Request OTP", callback_data: `otp:${signerToken}` },
        { text: "✏️ Edit Fields", url: `${appUrl}/sign/${signerToken}` },
      ],
      [{ text: "❌ Reject", callback_data: `reject:${signerToken}` }],
    ];
  }

  return sendTelegramMessage(
    chatId,
    `📋 *Document Action Required*\n\n` +
    `📄 *${documentTitle}*\n` +
    `👤 Role: ${role}${expiryLine}\n\n` +
    `Choose an action:`,
    { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } }
  );
}
