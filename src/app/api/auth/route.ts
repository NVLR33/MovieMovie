import { NextRequest, NextResponse } from 'next/server';
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
    return NextResponse.json({ user: publicUser(await getUser()) });
  } catch (e) {
    console.error('[AUTH:GET]', e);
    return NextResponse.json({ user: null });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSeed();
    const body = await req.json();
    const { action, email, password, username, telegramData } = body;

    console.log('[AUTH:POST] action:', action);

    if (action === 'logout') {
      await clearSession();
      return NextResponse.json({ ok: true });
    }

    // [AUTH:TELEGRAM]
    if (action === 'telegram') {
      if (!telegramData || !telegramData.id) {
        return NextResponse.json({ error: 'Нет данных Telegram' }, { status: 400 });
      }

      const telegramId = String(telegramData.id);
      let [u] = await db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1);

      if (!u) {
        const baseName = (telegramData.username || telegramData.first_name || 'tg_user')
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
            avatar: telegramData.photo_url || null,
            provider: 'telegram',
            providerId: telegramId,
          })
          .returning();
      }

      await setSession(u.id);
      return NextResponse.json({ user: publicUser(u) });
    }

    // [AUTH:CREDENTIALS]
    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Укажите почту и пароль' }, { status: 400 });
    }

    const mail = email.trim().toLowerCase();

    if (action === 'register') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) || password.length < 8 || !username?.trim() || username.length > 24) {
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
    console.error('[AUTH:POST] Error:', e);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
