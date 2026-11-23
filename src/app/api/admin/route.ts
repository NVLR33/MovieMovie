import { NextRequest, NextResponse } from 'next/server';
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { getUser } from '@/lib/auth';
import { db } from '@/db';
import { users, comments, movies, adminAudit } from '@/db/schema';
import {
  canAccessAdmin,
  canModerate,
  isAdministrator,
  permissionsFor,
} from '@/lib/permissions';
import {
  readJsonObject,
  requestFailure,
  RequestError,
} from '@/lib/request-validation';
import { manageAccount, curateCatalogue } from '@/lib/admin-server';
const json = (data: unknown) =>
  NextResponse.json(data, {
    headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
  });
const choices = (
  value: string | null,
  allowed: readonly string[],
  fallback: string,
) => {
  if (value === null) return fallback;
  if (!allowed.includes(value)) throw new RequestError('Некорректный фильтр');
  return value;
};
export async function GET(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) throw new RequestError('Войдите в аккаунт', 401);
    if (!canAccessAdmin(user)) throw new RequestError('Недостаточно прав', 403);
    const params = req.nextUrl.searchParams,
      section = params.get('section') || 'overview';
    const rawPage = params.get('page') || '1';
    if (!/^[1-9]\d{0,5}$/.test(rawPage))
      throw new RequestError('Некорректная страница');
    const page = Number(rawPage),
      limit = 25,
      offset = (page - 1) * limit;
    const query = (params.get('q') || '').trim();
    if (query.length > 150) throw new RequestError('Поиск — до 150 символов');
    if (section === 'users') {
      if (!isAdministrator(user))
        throw new RequestError(
          'Пользователи доступны только администратору',
          403,
        );
      const role = choices(
        params.get('role'),
        ['all', 'visitor', 'vip', 'moderator', 'admin', 'editor'],
        'all',
      );
      const state = choices(
        params.get('state'),
        ['all', 'active', 'suspended'],
        'all',
      );
      const sort = choices(
        params.get('sort'),
        ['newest', 'oldest', 'xp', 'name'],
        'newest',
      );
      const where = and(
        query
          ? or(
              ilike(users.username, `%${query}%`),
              ilike(users.email, `%${query}%`),
              /^\d+$/.test(query) && Number(query) <= 2147483647
                ? eq(users.id, Number(query))
                : undefined,
            )
          : undefined,
        role === 'editor'
          ? eq(users.isEditor, true)
          : role === 'all'
            ? undefined
            : eq(users.role, role),
        state === 'all'
          ? undefined
          : eq(users.isSuspended, state === 'suspended'),
      );
      const [count] = await db
        .select({ value: sql<number>`count(*)::int` })
        .from(users)
        .where(where);
      const rows = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          role: users.role,
          isEditor: users.isEditor,
          isSuspended: users.isSuspended,
          suspensionReason: users.suspensionReason,
          avatar: users.avatar,
          xp: users.xp,
          createdAt: users.createdAt,
          watches: sql<number>`(select count(*)::int from mg_watches w where w.user_id=${users.id})`,
          reviews: sql<number>`(select count(*)::int from mg_comments c where c.user_id=${users.id})`,
        })
        .from(users)
        .where(where)
        .orderBy(
          sort === 'oldest'
            ? asc(users.id)
            : sort === 'name'
              ? asc(users.username)
              : sort === 'xp'
                ? desc(users.xp)
                : desc(users.id),
          desc(users.id),
        )
        .limit(limit)
        .offset(offset);
      return json({
        items: rows,
        total: count.value,
        page,
        pages: Math.ceil(count.value / limit),
      });
    }
    if (section === 'audit') {
      if (!isAdministrator(user))
        throw new RequestError('Журнал доступен только администратору', 403);
      const action = params.get('action') || '';
      if (action.length > 60 || !/^[a-zA-Z.]*$/.test(action))
        throw new RequestError('Некорректное действие');
      const where = and(
        query
          ? or(
              ilike(adminAudit.summary, `%${query}%`),
              ilike(adminAudit.actorName, `%${query}%`),
            )
          : undefined,
        action ? eq(adminAudit.action, action) : undefined,
      );
      const [count] = await db
        .select({ value: sql<number>`count(*)::int` })
        .from(adminAudit)
        .where(where);
      const rows = await db
        .select()
        .from(adminAudit)
        .where(where)
        .orderBy(desc(adminAudit.id))
        .limit(limit)
        .offset(offset);
      return json({
        items: rows,
        total: count.value,
        page,
        pages: Math.ceil(count.value / limit),
      });
    }
    if (section === 'comments') {
      if (!canModerate(user)) throw new RequestError('Недостаточно прав', 403);
      const state = choices(
        params.get('state'),
        ['all', 'spoiler', 'reply'],
        'all',
      );
      const where = and(
        query
          ? or(
              ilike(comments.body, `%${query}%`),
              ilike(users.username, `%${query}%`),
              ilike(movies.title, `%${query}%`),
            )
          : undefined,
        state === 'spoiler'
          ? eq(comments.spoiler, true)
          : state === 'reply'
            ? sql`${comments.parentId} is not null`
            : undefined,
      );
      const [count] = await db
        .select({ value: sql<number>`count(*)::int` })
        .from(comments)
        .innerJoin(users, eq(comments.userId, users.id))
        .innerJoin(movies, eq(comments.movieId, movies.id))
        .where(where);
      const rows = await db
        .select({
          id: comments.id,
          body: comments.body,
          spoiler: comments.spoiler,
          parentId: comments.parentId,
          createdAt: comments.createdAt,
          userId: users.id,
          username: users.username,
          movieId: movies.id,
          title: movies.title,
        })
        .from(comments)
        .innerJoin(users, eq(comments.userId, users.id))
        .innerJoin(movies, eq(comments.movieId, movies.id))
        .where(where)
        .orderBy(desc(comments.id))
        .limit(limit)
        .offset(offset);
      return json({
        items: rows,
        total: count.value,
        page,
        pages: Math.ceil(count.value / limit),
      });
    }
    if (section !== 'overview') throw new RequestError('Неизвестный раздел');
    const result =
      await db.execute(sql`select (select count(*)::int from mg_movies) as materials,
      (select count(*)::int from mg_movies where featured=true) as featured,
      (select count(*)::int from mg_movies where description='' or poster='' or genre='' or country is null or country='') as incomplete`);
    const moderation = canModerate(user)
      ? (
          await db.execute(sql`select
      (select count(*)::int from mg_movie_suggestions where status='pending') as pending,
      (select count(*)::int from mg_comments) as comments,
      (select count(*)::int from mg_users) as members,
      (select count(*)::int from mg_users where created_at>=now()-interval '7 days') as new_members,
      (select count(*)::int from mg_watches where watched_at>=now()-interval '7 days') as weekly_watches`)
        ).rows[0]
      : null;
    const accounts = isAdministrator(user)
      ? (
          await db.execute(
            sql`select (select count(*)::int from mg_users where is_suspended) as suspended,(select count(*)::int from mg_users where is_editor) as editors`,
          )
        ).rows[0]
      : null;
    return json({
      permissions: permissionsFor(user),
      catalogue: result.rows[0],
      moderation,
      accounts,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    return requestFailure(error, 'Не удалось загрузить панель управления');
  }
}
export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) throw new RequestError('Войдите в аккаунт', 401);
    const body = await readJsonObject(req);
    const result = ['role', 'editor', 'suspend', 'revokeSessions'].includes(
      String(body.command),
    )
      ? await manageAccount(user, body)
      : await curateCatalogue(user, body);
    return json(result);
  } catch (error) {
    return requestFailure(error);
  }
}
