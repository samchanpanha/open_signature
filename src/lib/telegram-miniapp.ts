/**
 * Telegram Mini App (TMA) init-data validation.
 *
 * Validates the `initData` string sent by the Telegram Mini App SDK.
 * Uses HMAC-SHA256 with the bot token as the secret key.
 *
 * Docs: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
import crypto from 'crypto';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Parse the initData string into a URLSearchParams-like object.
 */
export function parseInitData(initData: string): URLSearchParams {
  return new URLSearchParams(initData);
}

/**
 * Validate Telegram Mini App init data.
 * Returns the parsed user data if valid, null if invalid.
 */
export function validateTelegramInitData(initData: string): { user?: { id: number; first_name: string; last_name?: string; username?: string; language_code?: string; is_premium?: boolean }; auth_date?: number; hash?: string } | null {
  if (!TELEGRAM_BOT_TOKEN) return null;

  const params = parseInitData(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  // Remove hash from params for validation
  const dataCheckArr: string[] = [];
  params.forEach((value, key) => {
    if (key !== 'hash') {
      dataCheckArr.push(`${key}=${value}`);
    }
  });

  // Sort alphabetically
  dataCheckArr.sort();

  // Create HMAC-SHA256 with bot token
  const secret = crypto.createHmac('sha256', 'WebAppData').update(TELEGRAM_BOT_TOKEN).digest();
  const dataCheckString = dataCheckArr.join('\n');
  const calculatedHash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  if (calculatedHash !== hash) return null;

  // Parse user data if present
  const userStr = params.get('user');
  let user: any = undefined;
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  return {
    user,
    auth_date: params.has('auth_date') ? parseInt(params.get('auth_date')!, 10) : undefined,
    hash,
  };
}

/**
 * Check if init data is recent (within maxAgeSeconds).
 */
export function isInitDataFresh(authDate: number, maxAgeSeconds: number = 86400): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now - authDate <= maxAgeSeconds;
}
