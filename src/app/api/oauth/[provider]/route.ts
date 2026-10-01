import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { setSession } from '@/lib/auth';
import { ensureSeed } from '@/lib/data';

// [AUTH:OAUTH] Authorization-code login for Yandex.
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

  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/oauth/yandex`;
  const code = req.nextUrl.searchParams.get('code');

  // Step 1: redirect user to Yandex
  if (!code) {
    const state = randomBytes(20).toString('hex');
    const url = new URL('https://oauth.yandex.com/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('scope', 'login:email login:info');

    const response = NextResponse.redirect(url);
    response.cookies.set('mg_oauth_yandex', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      maxAge: 600,
      path: '/',
    });
    return response;
  }

  // Step 2: exchange code for token
  const savedState = req.cookies.get('mg_oauth_yandex')?.value;
  const receivedState = req.nextUrl.searchParams.get('state');

  if (savedState !== receivedState) {
    console.error('[OAUTH] State mismatch:', { savedState, receivedState });
    return NextResponse.redirect(new URL('/?auth=state', req.url));
  }

  try {
    const tokenRes = await fetch('https://oauth.yandex.com/token', {
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
      throw Error('token');
    }

    const token = await tokenRes.json();

    const infoRes = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });

    if (!infoRes.ok) throw Error('userinfo');
    const info = await infoRes.json();

    const email = info.default_email?.toLowerCase();
    const providerId = String(info.id);
    if (!email || !providerId) throw Error('profile');

    await ensureSeed();

    let [u] = await db
      .select()
      .from(users)
      .where(and(eq(users.provider, 'yandex'), eq(users.providerId, providerId)))
      .limit(1);

    if (!u) {
      [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    }

    if (!u) {
      const base = (info.display_name || info.login || email.split('@')[0])
        .toLowerCase()
        .replace(/[^a-z0-9а-яё_]/gi, '')
        .slice(0, 18) || 'user';

      [u] = await db
        .insert(users)
        .values({
          email,
          username: `${base}${Math.floor(Math.random() * 9000 + 1000)}`,
          provider: 'yandex',
          providerId,
          avatar: info.default_avatar_id
            ? `https://avatars.yandex.net/get-yapic/${info.default_avatar_id}/islands-200`
            : undefined,
        })
        .returning();
    }

    await setSession(u.id);
    console.log('[OAUTH] Yandex login:', u.username);

    const response = NextResponse.redirect(new URL('/profile', req.url));
    response.cookies.delete('mg_oauth_yandex');
    return response;
  } catch (e) {
    console.error('[OAUTH] Error:', e);
    return NextResponse.redirect(new URL('/?auth=failed', req.url));
  }
}
