import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { clearSession, getUser, publicUser, setSession } from '@/lib/auth';
import { ensureSeed } from '@/lib/data';

// [API:AUTH] Credentials and Telegram-based account entry.
export async function GET() {
  await ensureSeed();
  return NextResponse.json({ user: publicUser(await getUser()) });
}

export async function POST(req: NextRequest) {
  try {
    await ensureSeed();
    const { action, email, password, username, telegramData } = await req.json();

    if (action === 'logout') {
      await clearSession();
      return NextResponse.json({ ok: true });
    }

    // [AUTH:TELEGRAM] Accept Telegram Login Widget payload or demo sandbox payload.
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
          .slice(0, 18);
        const safeName = baseName || 'tg_user';
        const generatedUsername = `${safeName}${Math.floor(Math.random() * 9000 + 1000)}`;
        const generatedEmail = `${telegramId}@telegram.local`;

        [u] = await db
          .insert(users)
          .values({
            telegramId,
            email: generatedEmail,
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

    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Укажите почту и пароль' }, { status: 400 });
    }

    const mail = email.trim().toLowerCase();

    if (action === 'register') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) || password.length < 8 || !username?.trim() || username.length > 24) {
        return NextResponse.json({ error: 'Проверьте данные: пароль от 8 символов' }, { status: 400 });
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
        .values({ email: mail, username: username.trim(), passwordHash: await bcrypt.hash(password, 12) })
        .returning();

      await setSession(u.id);
      return NextResponse.json({ user: publicUser(u) });
    }

    const [u] = await db.select().from(users).where(eq(users.email, mail)).limit(1);
    if (!u?.passwordHash || !(await bcrypt.compare(password, u.passwordHash))) {
      return NextResponse.json({ error: 'Неверная почта или пароль' }, { status: 401 });
    }

    await setSession(u.id);
    return NextResponse.json({ user: publicUser(u) });
  } catch {
    return NextResponse.json({ error: 'Не удалось выполнить запрос' }, { status: 500 });
  }
}
