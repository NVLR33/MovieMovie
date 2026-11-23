import { NextRequest, NextResponse } from 'next/server';
import { oauthSiteOrigin, validOAuthState } from '@/lib/auth-validation';
import { databaseErrorCode, isAuthSchemaError } from '@/lib/auth-errors';
import { RequestError, isDatabaseFailure } from '@/lib/request-validation';
import { randomBytes, randomUUID } from 'crypto';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { setSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
const STATE_COOKIE = 'mg_oauth_yandex';
class OAuthFailure extends Error {
  constructor(public reason: 'token' | 'profile' | 'unavailable') {
    super(reason);
  }
}
function redirect(url: URL | string) {
  const response = NextResponse.redirect(url);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
function failure(baseUrl: string, reason: string) {
  const url = new URL('/', baseUrl);
  url.searchParams.set('auth', reason);
  const response = redirect(url);
  response.cookies.set(STATE_COOKIE, '', {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(baseUrl).protocol === 'https:',
  });
  return response;
}
async function yandexJson(
  url: string,
  init: RequestInit,
  reason: 'token' | 'profile',
) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new OAuthFailure('unavailable');
  }
  if (!response.ok)
    throw new OAuthFailure(
      response.status >= 500 || response.status === 429
        ? 'unavailable'
        : reason,
    );
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new OAuthFailure(reason);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new OAuthFailure(reason);
  return value as Record<string, unknown>;
}

// Canonicalize BEFORE setting host-only state cookie: www/apex/preview aliases must
// not leave the CSRF cookie on a different host from the registered callback.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  let baseUrl: string;
  try {
    baseUrl = oauthSiteOrigin();
  } catch {
    console.error('[OAUTH] Invalid site URL configuration');
    return failure('https://moviemovie.ru', 'config');
  }
  if (provider !== 'yandex') return failure(baseUrl, 'provider');
  const clientId = process.env.YANDEX_CLIENT_ID?.trim();
  const clientSecret = process.env.YANDEX_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    console.error('[OAUTH] Yandex credentials not configured');
    return failure(baseUrl, 'config');
  }
  const redirectUri = `${baseUrl}/api/oauth/yandex`;
  // Host remains external behind reverse proxies whose internal URL uses HTTP/localhost.
  const requestHost = req.headers.get('host') || req.nextUrl.host;
  const canonicalHost = new URL(baseUrl).host;
  const isCallback =
    req.nextUrl.searchParams.has('code') ||
    req.nextUrl.searchParams.has('error');
  if (!isCallback) {
    if (requestHost !== canonicalHost) return redirect(redirectUri);
    const state = randomBytes(32).toString('hex');
    const url = new URL('https://oauth.yandex.ru/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('scope', 'login:email login:info');
    const response = redirect(url);
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: new URL(baseUrl).protocol === 'https:',
      maxAge: 600,
      path: '/',
    });
    return response;
  }
  // Never bypass state checking, share cookies across subdomains, or forward codes
  // received on an unregistered origin to the real callback.
  const savedState = req.cookies.get(STATE_COOKIE)?.value;
  const receivedState = req.nextUrl.searchParams.get('state');
  if (
    requestHost !== canonicalHost ||
    !validOAuthState(savedState, receivedState)
  ) {
    console.warn('[OAUTH] State/origin verification failed');
    return failure(baseUrl, 'state');
  }
  if (req.nextUrl.searchParams.has('error')) {
    return failure(
      baseUrl,
      req.nextUrl.searchParams.get('error') === 'access_denied'
        ? 'cancelled'
        : 'token',
    );
  }
  const code = req.nextUrl.searchParams.get('code');
  if (!code || code.length > 4096) return failure(baseUrl, 'token');
  let stage: 'token' | 'profile' | 'database' | 'session' = 'token';
  const requestId = randomUUID();
  try {
    const token = await yandexJson(
      'https://oauth.yandex.ru/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        }),
      },
      'token',
    );
    if (typeof token.access_token !== 'string' || !token.access_token)
      throw new OAuthFailure('token');
    stage = 'profile';
    const info = await yandexJson(
      'https://login.yandex.ru/info?format=json',
      { headers: { Authorization: `OAuth ${token.access_token}` } },
      'profile',
    );
    const email =
      typeof info.default_email === 'string'
        ? info.default_email.trim().toLowerCase()
        : '';
    const providerId =
      typeof info.id === 'string' || typeof info.id === 'number'
        ? String(info.id)
        : '';
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      !/^\d{1,100}$/.test(providerId)
    )
      throw new OAuthFailure('profile');
    stage = 'database';
    let [u] = await db
      .select()
      .from(users)
      .where(
        and(eq(users.provider, 'yandex'), eq(users.providerId, providerId)),
      )
      .limit(1);
    if (!u)
      [u] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
    if (!u) {
      const name = [info.display_name, info.login].find(
        (value) => typeof value === 'string' && value.trim(),
      ) as string | undefined;
      const base =
        (name || email.split('@')[0])
          .toLowerCase()
          .replace(/[^a-z0-9а-яё_]/gi, '')
          .slice(0, 15) || 'user';
      // A random UUID suffix avoids the former 9,000-name collision window.
      [u] = await db
        .insert(users)
        .values({
          email,
          username: `${base}_${randomBytes(4).toString('hex')}`,
          provider: 'yandex',
          providerId,
          role: 'visitor',
          avatar:
            typeof info.default_avatar_id === 'string' &&
            /^[a-zA-Z0-9_\/-]{1,200}$/.test(info.default_avatar_id)
              ? `https://avatars.yandex.net/get-yapic/${info.default_avatar_id}/islands-200`
              : undefined,
          xp: 100,
        })
        .onConflictDoNothing()
        .returning();
      // Two simultaneous logins may create the same email; reuse the winner.
      if (!u)
        [u] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
      if (!u) throw new Error('account_creation_failed');
    }
    stage = 'session';
    await setSession(u.id);
    const response = redirect(new URL('/', baseUrl));
    response.cookies.set(STATE_COOKIE, '', {
      path: '/',
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure: new URL(baseUrl).protocol === 'https:',
    });
    return response;
  } catch (error) {
    const reason = isAuthSchemaError(error)
      ? 'schema'
      : error instanceof OAuthFailure
        ? error.reason
        : error instanceof RequestError && error.status === 403
          ? 'blocked'
          : isDatabaseFailure(error)
            ? 'database'
            : stage === 'session'
              ? 'session'
              : stage === 'database'
                ? 'database'
                : stage;
    // No error objects: database errors can contain SQL/PII, provider errors can
    // contain authorization codes, access tokens or application secrets.
    console.error('[OAUTH] Login failed', {
      requestId,
      stage,
      reason,
      sqlState: databaseErrorCode(error),
    });
    return failure(baseUrl, reason);
  }
}
