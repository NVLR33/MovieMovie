import { NextRequest, NextResponse } from 'next/server';
import { and, eq, or, desc, sql } from 'drizzle-orm';
import { getUser } from '@/lib/auth';
import { db } from '@/db';
import { messages, users, friendships, movies } from '@/db/schema';

// [API:CHAT] Direct message history between friends.
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Необходимо войти' }, { status: 401 });

  const withId = Number(req.nextUrl.searchParams.get('with'));

  if (withId) {
    // [CHAT:CONVERSATION] Load message thread between two users.
    const [friendship] = await db.select().from(friendships).where(
      and(
        or(
          and(eq(friendships.fromId, user.id), eq(friendships.toId, withId)),
          and(eq(friendships.fromId, withId), eq(friendships.toId, user.id))
        ),
        eq(friendships.status, 'accepted')
      )
    ).limit(1);
    if (!friendship) return NextResponse.json({ error: 'Вы не являетесь друзьями' }, { status: 403 });

    const thread = await db.select().from(messages).where(
      or(
        and(eq(messages.fromId, user.id), eq(messages.toId, withId)),
        and(eq(messages.fromId, withId), eq(messages.toId, user.id))
      )
    ).orderBy(messages.createdAt).limit(200);

    // Mark incoming messages as read
    await db.update(messages).set({ read: true }).where(
      and(eq(messages.fromId, withId), eq(messages.toId, user.id), eq(messages.read, false))
    );

    // Attach film data to shared messages
    const filmIds = [...new Set(thread.filter(m => m.movieId).map(m => m.movieId!))];
    const films = filmIds.length
      ? await db.select({ id: movies.id, title: movies.title, poster: movies.poster, year: movies.year, category: movies.category }).from(movies).where(sql`${movies.id} IN (${sql.join(filmIds.map(id => sql`${id}`), sql`, `)})`)
      : [];
    const filmMap = Object.fromEntries(films.map(f => [f.id, f]));

    return NextResponse.json({
      messages: thread.map(m => ({
        ...m,
        film: m.movieId ? filmMap[m.movieId] || null : null,
      })),
    });
  }

  // [CHAT:INBOX] Overview of all conversations — latest message + unread count per friend.
  const allMessages = await db.select().from(messages).where(
    or(eq(messages.fromId, user.id), eq(messages.toId, user.id))
  ).orderBy(desc(messages.createdAt));

  const convMap = new Map<number, { lastMsg: typeof allMessages[number]; unread: number }>();
  for (const m of allMessages) {
    const peerId = m.fromId === user.id ? m.toId : m.fromId;
    if (!convMap.has(peerId)) {
      convMap.set(peerId, { lastMsg: m, unread: 0 });
    }
    if (m.toId === user.id && !m.read) {
      convMap.get(peerId)!.unread++;
    }
  }

  const peerIds = [...convMap.keys()];
  const peers = peerIds.length
    ? await db.select({ id: users.id, username: users.username, avatar: users.avatar, role: users.role, xp: users.xp }).from(users).where(sql`${users.id} IN (${sql.join(peerIds.map(id => sql`${id}`), sql`, `)})`)
    : [];
  const peerMap = Object.fromEntries(peers.map(p => [p.id, p]));

  const conversations = peerIds
    .map(id => {
      const conv = convMap.get(id)!;
      return {
        peer: peerMap[id] || null,
        lastMessage: conv.lastMsg.body.slice(0, 80),
        lastMessageAt: conv.lastMsg.createdAt,
        unread: conv.unread,
        hasFilm: !!conv.lastMsg.movieId,
      };
    })
    .filter(c => c.peer)
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  return NextResponse.json({ conversations });
}

// [API:CHAT:SEND] Send a message to a friend.
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Необходимо войти' }, { status: 401 });

  try {
    const body = await req.json();
    const toId = Number(body.toId);
    const text = String(body.text || '').trim().slice(0, 2000);
    const movieId = body.movieId ? Number(body.movieId) : null;

    if (!text && !movieId) throw Error('Сообщение не может быть пустым');
    if (toId === user.id) throw Error('Нельзя написать самому себе');

    // Check friendship
    const [friendship] = await db.select().from(friendships).where(
      and(
        or(
          and(eq(friendships.fromId, user.id), eq(friendships.toId, toId)),
          and(eq(friendships.fromId, toId), eq(friendships.toId, user.id))
        ),
        eq(friendships.status, 'accepted')
      )
    ).limit(1);
    if (!friendship) throw Error('Отправлять сообщения можно только друзьям');

    // Verify movie exists if sharing
    if (movieId) {
      const [film] = await db.select({ id: movies.id }).from(movies).where(eq(movies.id, movieId)).limit(1);
      if (!film) throw Error('Материал не найден');
    }

    const msgBody = movieId && !text ? '📎 Поделился материалом' : text;

    const [msg] = await db.insert(messages).values({
      fromId: user.id,
      toId,
      body: msgBody,
      movieId,
    }).returning();

    return NextResponse.json({ ok: true, message: msg });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка отправки' }, { status: 400 });
  }
}
