import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { setSession } from '@/lib/auth';
import { ensureSeed } from '@/lib/data';

// [AUTH:OAUTH] Авторизация через Яндекс OAuth
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;

  if (provider !== 'yandex') {
    return NextResponse.redirect(new URL('/?auth=provider', req.url));
  }

  const clientId = process.env.YANDEX_CLIENT_ID;
  const clientSecret = process.env.YANDEX_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[OAUTH] Yandex credentials not configured');
    return NextResponse.redirect(new URL('/?auth=config', req.url));
  }

  // Динамический Callback URL под любой текущий домен (moviemovie.duckdns.org или vercel.app)
  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/oauth/yandex`;
  const code = req.nextUrl.searchParams.get('code');

  // Шаг 1: Перенаправление пользователя на страницу авторизации Яндекс
  if (!code) {
    const state = randomBytes(20).toString('hex');
    const url = new URL('https://oauth.yandex.ru/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('scope', 'login:email login:info');

    const response = NextResponse.redirect(url);
    response.cookies.set('mg_oauth_yandex', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600,
      path: '/',
    });
    return response;
  }

  // Шаг 2: Проверка состояния state
  const savedState = req.cookies.get('mg_oauth_yandex')?.value;
  const receivedState = req.nextUrl.searchParams.get('state');

  if (savedState && receivedState && savedState !== receivedState) {
    console.warn('[OAUTH] State mismatch warning:', { savedState, receivedState });
  }

  try {
    // Обмен authorization code на access_token
    const tokenRes = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('[OAUTH] Token error:', tokenRes.status, errBody);
      throw new Error('token_failed');
    }

    const token = await tokenRes.json();

    // Запрос данных профиля пользователя из Яндекс ID
    const infoRes = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { Authorization: `OAuth ${token.access_token}` },
    });

    if (!infoRes.ok) throw new Error('userinfo_failed');
    const info = await infoRes.json();

    const email = info.default_email?.toLowerCase();
    const providerId = String(info.id);
    if (!email || !providerId) throw new Error('profile_invalid');

    await ensureSeed();

    // Поиск существующего аккаунта
    let [u] = await db
      .select()
      .from(users)
      .where(and(eq(users.provider, 'yandex'), eq(users.providerId, providerId)))
      .limit(1);

    if (!u) {
      [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    }

    // Если пользователя еще нет в базе — создаем его
    if (!u) {
      const base = (info.display_name || info.login || email.split('@')[0])
        .toLowerCase()
        .replace(/[^a-z0-9а-яё_]/gi, '')
        .slice(0, 15) || 'user';

      const uniqueUsername = `${base}_${Math.floor(Math.random() * 9000 + 1000)}`;

      [u] = await db
        .insert(users)
        .values({
          email,
          username: uniqueUsername,
          provider: 'yandex',
          providerId,
          role: 'visitor',
          avatar: info.default_avatar_id
            ? `https://avatars.yandex.net/get-yapic/${info.default_avatar_id}/islands-200`
            : undefined,
          xp: 100
        })
        .returning();
    }

    // Сохранение авторизационной сессии
    await setSession(u.id);
    console.log('[OAUTH] Yandex login success:', u.username);

    const response = NextResponse.redirect(new URL('/', req.url));
    response.cookies.delete('mg_oauth_yandex');
    return response;
  } catch (e) {
    console.error('[OAUTH] Yandex auth error:', e);
    return NextResponse.redirect(new URL('/?auth=failed', req.url));
  }
}
