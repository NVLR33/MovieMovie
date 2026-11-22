import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Telegram Login Widget uses SHA256(bot token) as the HMAC key (not Web App initData).
export function verifyTelegramLogin(
  input: unknown,
  botToken: string,
  now = Math.floor(Date.now() / 1000),
): input is Record<string, string | number> & { id: number; auth_date: number; hash: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !botToken) return false;
  const data = input as Record<string, unknown>;
  if (!Number.isSafeInteger(data.id) || Number(data.id) <= 0 ||
      !Number.isSafeInteger(data.auth_date) || Number(data.auth_date) > now + 60 ||
      now - Number(data.auth_date) > 86400 ||
      typeof data.hash !== 'string' || !/^[a-f\d]{64}$/i.test(data.hash)) return false;

  const entries = Object.entries(data).filter(([key]) => key !== 'hash');
  if (entries.some(([, value]) => typeof value !== 'string' && typeof value !== 'number')) return false;
  const checkString = entries.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHash('sha256').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(checkString).digest();
  return timingSafeEqual(expected, Buffer.from(data.hash, 'hex'));
}

export function validOAuthState(saved: string | undefined, received: string | null) {
  return !!saved && !!received && saved === received;
}

export function sessionSecret(env: NodeJS.ProcessEnv = process.env) {
  if (env.SESSION_SECRET && env.SESSION_SECRET.length >= 32) return env.SESSION_SECRET;
  if (env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must contain at least 32 characters in production');
  }
  return 'development-only-secret-not-for-production';
}
