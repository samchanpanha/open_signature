# Telegram Bot Integration for Document Signing — Technical Architecture & Implementation Guide

This guide describes how to connect a Telegram bot to the OpenSign web application so an
administrator can assign a signer to a document and have that signer receive an interactive
Telegram notification with a one-tap link to sign (using the app's existing custom signature pad).

The implementation is **already scaffolded in this repo** under `src/lib/telegram.ts` and
`src/app/api/telegram/*`, wired into `AlertEngine`. This document explains the design and how
to complete/operate it in production.

---

## 1. System Architecture

### Flow: assign → notify → sign

```
┌────────────┐   POST /api/assignments   ┌──────────────────────┐
│  Admin UI  │ ───────────────────────► │ Assignment created     │
│ (web app)  │                          │ (owner/admin only)     │
└────────────┘                          └───────────┬──────────┘
                                                          │
                                                          ▼
                                              ┌──────────────────────┐
                                              │ AlertEngine.notify*   │
                                              │  • in-app Notification │
                                              │  • Email (nodemailer)  │
                                              │  • Telegram (if linked)│
                                              └───────────┬──────────┘
                                                          │ sendMessage (HTTPS)
                                                          ▼
                                              ┌──────────────────────┐
                                              │   Telegram Bot API    │
                                              │  api.telegram.org/bot │
                                              └───────────┬──────────┘
                                                          │ inline button
                                                          ▼
                                              ┌──────────────────────┐
                                              │   Signer's Telegram   │
                                              │  "Sign Document" ──►   │
                                              │   app URL /?sign=TOKEN │
                                              └───────────┬──────────┘
                                                          │ opens web app
                                                          ▼
                                              ┌──────────────────────┐
                                              │  Signer view + custom │
                                              │  signature pad        │
                                              └──────────────────────┘
```

### Key mapping to existing code
- **Assignment**: `src/app/api/assignments/route.ts` (already enforces owner/admin and creates an in-app notification).
- **Signer link**: each `Signer` already has a unique `token` (`prisma/schema.prisma:250`) used by the web app at `/?sign=TOKEN`. **We reuse this exact token** for the Telegram button — no new per-link secret to manage.
- **Notifications**: `src/app/api/notifications/route.ts` + `Notification` model. Telegram is an additional channel inside `AlertEngine`.
- **Signature pad**: the signer view renders the custom canvas signature pad; Telegram simply deep-links into it.

### New components added
| File | Responsibility |
|------|----------------|
| `src/lib/telegram.ts` | Typed Bot API wrapper (`sendMessage`, `answerCallbackQuery`, `setWebhook`, `deleteWebhook`, `getMe`), payload validation helper. |
| `src/app/api/telegram/connect/route.ts` | `GET` → issues a one-time `TelegramBinding.token` + `t.me/<bot>?start=<token>` deep link. |
| `src/app/api/telegram/link/route.ts` | `GET ?token=` → poll whether the token was redeemed by the bot. |
| `src/app/api/telegram/webhook/route.ts` | `POST` → handles `/start <token>` (link) and `callback_query` (Acknowledge / Open). |
| `src/app/api/telegram/manage/route.ts` | `POST {action:'set'\|'delete'}` → register/unregister webhook (ops, `CRON_SECRET` guarded). |
| `prisma/schema.prisma` | `User.telegramChatId` (+ `telegramLinkedAt`) and `TelegramBinding` model. |

---

## 2. User Mapping & Identification (secure Chat-ID linking)

You must never ask users to paste their numeric chat id (error-prone, spoofable). Use a
**token-exchange ("Start") flow**:

1. User clicks **"Connect Telegram"** in the web app settings.
2. `GET /api/telegram/connect` (auth required) creates a `TelegramBinding` row with a
   cryptographically random `token` (`crypto.randomBytes(24)`) and returns a deep link:
   `https://t.me/<BOT_USERNAME>?start=<token>`.
3. User taps the link → Telegram opens a chat with the bot and sends `/start <token>`.
4. The webhook receives the `message`, captures the real `chat.id` from Telegram's own
   payload (never user-supplied), and redeems the binding:
   - marks `consumedAt`,
   - sets `chatId`, `username`, `firstName`,
   - writes `User.telegramChatId` so future notifications route correctly.

**Why this is safe:**
- The chat id comes from Telegram's authenticated payload, not from the user.
- The token is single-use (`consumedAt` set) and random — guessing it yields nothing.
- Linking is bound to the **currently authenticated web user** (`linkedUserId` set at connect time), so even if two users exchanged tokens, the chat binds to whoever initiated the connect in-app.
- `telegramChatId` is `@unique`, preventing duplicate bindings.

**Best practices**
- One Telegram account per web user (enforce the unique constraint; offer an "unlink" that
  clears `telegramChatId` + consumes any binding).
- Show the user a short "Opening Telegram… tap Start" instruction; optionally poll
  `/api/telegram/link?token=` every 2s for ~60s to auto-confirm.
- Allow re-linking: if `telegramChatId` already set, `/connect` returns `{ linked: true }`
  and skips token issuance.

---

## 3. Notification Mechanism (`sendMessage` + inline buttons)

`src/lib/telegram.ts:sendTelegramMessage(chatId, text, { parse_mode, reply_markup })` posts to
`https://api.telegram.org/bot<TOKEN>/sendMessage`.

`AlertEngine.notifyTelegram(userId, text, buttons?)` (in `alert-engine.ts`) resolves the user's
`telegramChatId` and sends. For a signing request it builds an inline keyboard:

```ts
await this.notifyTelegram(
  step.userId,
  `✍️ *Signature required*\nStep ${currentStep}/${totalSteps}: "${step.name}"\nDocument: *${documentTitle}*`,
  [{ text: "Sign Document", callback_data: `open:${signer.token}` }]
);
```

Use **`callback_data`** (not a raw `url`) for the button so you can:
- Guarantee the signer opens the **correct, current signing link** (the `Signer.token`),
- Log the tap (Acknowledge) via `answerCallbackQuery` + an audit entry,
- Avoid leaking the link in a bare URL preview.

The `open:<token>` callback simply `answerCallbackQuery`s and lets the user tap through to
`${NEXT_PUBLIC_APP_URL}/?sign=<token>` (set the button's `url` in the UI reply, or send a
follow-up message with a `url` button). For the secure link, prefer:

```
${NEXT_PUBLIC_APP_URL}/?sign=<Signer.token>
```

**Message content best practices**
- Lead with action + document title; keep ≤ 3 lines (mobile).
- Use `parse_mode: "Markdown"` for emphasis, but escape user-supplied text
  (`_`, `*`, `` ` ``, `[`).
- Provide clear instructions: *"Tap Sign Document, draw your signature in the pad, then Finish."*
- Include a short expiry note if the document has `expiresAt`.

---

## 4. Webhooks (`setWebhook`) vs Long Polling (`getUpdates`)

| Dimension | Webhook (`setWebhook`) | Long Polling (`getUpdates`) |
|-----------|------------------------|------------------------------|
| Model | Telegram **pushes** Updates to your HTTPS URL | Your server **pulls** on an interval |
| Latency | Near real-time | Up to `timeout` (recommended 30–50s) |
| Infra | Needs a public HTTPS endpoint (Vercel/your deploy) | Works behind NAT / local dev (no public URL) |
| Concurrency | One Update per request; handle idempotently | You control batch size/offset |
| Scaling | Stateless, serverless-friendly (Next.js route) | Needs a long-lived process; fights serverless cold starts |
| Failure | Telegram retries with backoff; **always return 200** | You own the loop + backoff |
| Secret auth | `X-Telegram-Bot-Api-Secret-Token` header (Bot API 6.2+) | N/A (you call the API with the token) |

**Recommendation: use Webhooks for production.** This app is Next.js (serverless/Vercel), which
is a perfect webhook target and a poor fit for a persistent polling loop.

Our `webhook/route.ts`:
- Validates `x-telegram-bot-api-secret-token === TELEGRAM_WEBHOOK_SECRET` (returns 401 otherwise).
- Parses the Update, dispatches `message` (`/start`) or `callback_query` (buttons).
- **Always returns `{ ok: true }`** (200) so Telegram doesn't retry a handled update.
- Catches all processing errors and logs them; never lets an exception bubble to a 5xx.

Long polling is only recommended for **local development** when you have no public URL; in that
case run a small script that loops `getUpdates` and forwards to the same handler logic. Do not
run both webhook + polling simultaneously (Telegram disables the webhook when you call
`getUpdates`).

Register the webhook once after deploy via `POST /api/telegram/manage {action:'set'}` (guarded by
`CRON_SECRET`), or directly with `setWebhook`. Pass `secret_token` and `allowed_updates:
["message","callback_query"]`.

---

## 5. Security & Data Integrity

1. **Validate inbound payloads.** The webhook enforces the `secret_token` header; Telegram sets
   it only on requests it originates, so a random internet POST is rejected with 401.
2. **HTTPS everywhere.** Bot API calls go to `https://api.telegram.org`. The webhook URL
   (`TELEGRAM_WEBHOOK_URL`) must be `https`. Keep `TELEGRAM_BOT_TOKEN` server-side only.
3. **Treat the chat id as PII.** Store `telegramChatId` on the user; restrict who can read it
   (owner/admin). Never log full tokens/chat ids in plaintext.
4. **Signing links are guarded by the existing `Signer.token` flow** (`sign/[token]/route.ts`):
   checks expiry, completion, rejection, and **sequential signing order** before returning data.
   Telegram merely deep-links into that already-secured endpoint — no new attack surface.
5. **One-time link tokens.** `TelegramBinding.token` is random + single-use (`consumedAt`).
6. **Idempotent callbacks.** Guard against duplicate `callback_query` (Telegram may resend on
   network blips) — our Acknowledge write is append-only audit; the "open" action is read-only.
7. **Rate limits.** Respect Telegram's ~20 msgs/min per chat; batch/queue if sending bulk. Wrap
   `sendTelegramMessage` in retry-with-backoff for `429`/network errors.
8. **Input escaping.** Escape any document title / signer name placed in Markdown text to avoid
   broken formatting or injection of Telegram entities.
9. **Webhook URL confidentiality.** Don't expose it; rotate `TELEGRAM_WEBHOOK_SECRET` if leaked
   (re-run `setWebhook` with a new secret).

---

## 6. Implementation Roadmap (production checklist)

### Step 1 — Create the bot
- Talk to [@BotFather](https://t.me/BotFather): `/newbot` → note the **HTTP API token** →
  `/setcommands` (start, help) → optional `/setdescription`. Copy the token to
  `TELEGRAM_BOT_TOKEN` and the username to `TELEGRAM_BOT_USERNAME`.

### Step 2 — Environment variables
```
TELEGRAM_BOT_TOKEN=123456:ABC-def…
TELEGRAM_BOT_USERNAME=YourOpenSignBot
TELEGRAM_WEBHOOK_SECRET=<random 32+ char secret>   # header validation
TELEGRAM_WEBHOOK_URL=https://your-app.com/api/telegram/webhook
NEXT_PUBLIC_APP_URL=https://your-app.com
CRON_SECRET=<shared ops secret for /api/telegram/manage>
```

### Step 3 — Schema & client
```
npx prisma db push --accept-data-loss   # adds User.telegramChatId + TelegramBinding
npx prisma generate
```
(Already applied in this branch.)

### Step 4 — Register the webhook (post-deploy, idempotent)
```
curl -X POST https://your-app.com/api/telegram/manage \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"set"}'
```
Or directly: `POST https://api.telegram.org/bot<TOKEN>/setWebhook` with `url`,
`secret_token`, `allowed_updates`.

### Step 5 — UI (optional but recommended)
- Settings page: "Connect Telegram" → calls `/api/telegram/connect`, opens deep link, polls
  `/api/telegram/link?token=`.
- "Unlink" clears `telegramChatId`.
- (The backend + AlertEngine wiring is already complete; only the in-app button UI remains.)

### Step 6 — Libraries
- No extra dependency required — the Bot API is plain HTTPS (`fetch`). If you prefer a
  batteries-included client: `node-telegram-bot-api` or `grammy` (grammy has great webhook
  secret + middleware support). For polling dev: `grammy` or a 15-line `getUpdates` loop.

### Step 7 — Error handling strategy
- `TelegramError` class carries `status` + `body`; log and continue (don't crash the request).
- Retry `sendMessage` on `429` (retry_after) and transient 5xx with exponential backoff (max 3).
- Webhook route **always returns 200**; log processing failures, never throw to Telegram.
- If a user unlinks mid-flow, `notifyTelegram` silently no-ops (chat id null) — safe.

### Step 8 — Testing
- **Unit**: `telegram.ts` — mock `fetch`, assert URL/method/body for each method; assert
  `secret_token` is sent on `setWebhook`.
- **Linking**: start dev server, call `/connect` → get token → simulate a `POST /webhook` with a
  fake `message.text="/start <token>"` + `chat.id` → assert `User.telegramChatId` is set and
  binding `consumedAt` is not null.
- **Auth**: `POST /webhook` without the secret header → expect 401.
- **Notify**: create an assignment for a user with a linked chat → assert a `sendMessage` was
  issued with `reply_markup.inline_keyboard` containing `open:<token>`.
- **Callback**: post a `callback_query` `ack:<token>` → assert audit log + notification created
  and `answerCallbackQuery` called.
- **Security**: expired/completed document token in `open:`/`ack:` still opens the app, but
  `sign/[token]` enforces status (no signing of a finished doc).
- **E2E**: a real phone with Telegram → connect → admin assigns a doc → receive message → tap →
  sign with the custom pad → owner gets "completed" Telegram + in-app notification.

### Step 9 — Operations
- Monitor webhook delivery in BotFather `/getWebhookInfo` (pending_update_count, last_error).
- Alert on repeated `TelegramError` (token revoked → `401` from API).
- Rotate `TELEGRAM_WEBHOOK_SECRET` and re-`setWebhook` if compromised.
- Keep `TELEGRAM_BOT_TOKEN` in your secret manager, never in client bundles.

---

## Files created/modified in this branch
- `src/lib/telegram.ts` (new)
- `src/app/api/telegram/connect/route.ts` (new)
- `src/app/api/telegram/link/route.ts` (new)
- `src/app/api/telegram/webhook/route.ts` (new)
- `src/app/api/telegram/manage/route.ts` (new)
- `src/lib/alerts/alert-engine.ts` (added `notifyTelegram` + Telegram sends in `notifyWorkflowStep`/`notifyDocumentOwner`)
- `prisma/schema.prisma` (added `User.telegramChatId`/`telegramLinkedAt` + `TelegramBinding`)

Status: **backend complete & type-checks/builds**; remaining item is the in-app "Connect
Telegram" settings button UI (Step 5), which is a thin client wrapper over the existing routes.
