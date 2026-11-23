import { AUTH_MESSAGES, isAuthSchemaError, databaseErrorCode } from '@/lib/auth-errors';
import { readJsonObject, RequestError, requestFailure, isDatabaseFailure } from '@/lib/request-validation';
import { NextRequest, NextResponse } from 'next/server';
import { verifyTelegramLogin } from '@/lib/auth-validation';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { clearSession, getUser, publicUser, setSession } from '@/lib/auth';
import { ensureSeed } from '@/lib/data';

// [API:AUTH] Credentials, Telegram, and session management.
export async function GET() {
  try {
    await ensureSeed();
    return NextResponse.json({ user: publicUser(await getUser()) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    console.error('[AUTH:GET]', e);
    return NextResponse.json({ user: null });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonObject(req);
    await ensureSeed();
    const { action, email, password, username, telegramData } = body;

    if (typeof action !== 'string') throw new RequestError('Укажите действие');

    if (action === 'logout') {
      await clearSession();
      return NextResponse.json({ ok: true });
    }

    // [AUTH:TELEGRAM]
    if (action === 'telegram') {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) return NextResponse.json({ error: 'Вход через Telegram не настроен' }, { status: 503 });
      if (!verifyTelegramLogin(telegramData, botToken)) {
        return NextResponse.json({ error: 'Недействительные данные Telegram' }, { status: 401 });
      }

      const telegramId = String(telegramData.id);
      let [u] = await db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1);

      if (!u) {
        const baseName = String(telegramData.username || telegramData.first_name || 'tg_user')
          .toLowerCase()
          .replace(/[^a-z0-9_а-яё]/gi, '')
          .slice(0, 18) || 'tg_user';
        const generatedUsername = `${baseName}${Math.floor(Math.random() * 9000 + 1000)}`;

        [u] = await db
          .insert(users)
          .values({
            telegramId,
            email: `${telegramId}@telegram.local`,
            username: generatedUsername,
            avatar: typeof telegramData.photo_url === 'string' && telegramData.photo_url.startsWith('https://') ? telegramData.photo_url : null,
            provider: 'telegram',
            providerId: telegramId,
          })
          .returning();
      }

      await setSession(u.id);
      return NextResponse.json({ user: publicUser(u) });
    }

    if (action !== 'register' && action !== 'login') {
      return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
    }

    // [AUTH:CREDENTIALS]
    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Укажите почту и пароль' }, { status: 400 });
    }

    const mail = email.trim().toLowerCase();
    if (mail.length > 254 || Buffer.byteLength(password, 'utf8') > 72) {
      return NextResponse.json({ error: 'Слишком длинная почта или пароль (максимум 72 байта)' }, { status: 400 });
    }

    if (action === 'register') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72 || typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 24) {
        return NextResponse.json({ error: 'Проверьте данные: email, пароль от 8 символов, имя от 3 до 24 символов' }, { status: 400 });
      }

      const exists = await db
        .select({ id: users.id })
        .from(users)
        .where(or(eq(users.email, mail), eq(users.username, username.trim())))
        .limit(1);

      if (exists.length) {
        return NextResponse.json({ error: 'Почта или имя уже используются' }, { status: 409 });
      }

      const [u] = await db
        .insert(users)
        .values({
          email: mail,
          username: username.trim(),
          passwordHash: await bcrypt.hash(password, 10),
        })
        .returning();

      await setSession(u.id);
      console.log('[AUTH] Registered:', u.username);
      return NextResponse.json({ user: publicUser(u) });
    }

    // Login
    const [u] = await db.select().from(users).where(eq(users.email, mail)).limit(1);
    if (!u?.passwordHash || !(await bcrypt.compare(password, u.passwordHash))) {
      return NextResponse.json({ error: 'Неверная почта или пароль' }, { status: 401 });
    }

    await setSession(u.id);
    console.log('[AUTH] Login:', u.username);
    return NextResponse.json({ user: publicUser(u) });
  } catch (e) {
    if (isAuthSchemaError(e)) {
      console.error('[AUTH] Database schema is not ready', { sqlState: databaseErrorCode(e) });
      return NextResponse.json({ error: AUTH_MESSAGES.schema }, { status: 503 });
    }
    if (e instanceof RequestError) return requestFailure(e);
    if (isDatabaseFailure(e) && ((e as { code?: string }).code === '23505' || (e as { cause?: { code?: string } }).cause?.code === '23505')) return NextResponse.json({ error: 'Почта или имя уже используются' }, { status: 409 });
    console.error('[AUTH:POST] Error:', e);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
