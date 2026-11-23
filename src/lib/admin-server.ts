import { eq, inArray, sql, asc } from 'drizzle-orm';
import { db } from '@/db';
import { users, movies, movieClub } from '@/db/schema';
import { isAdministrator } from './permissions';
import { databaseId, RequestError } from './request-validation';
import { writeAdminAudit, type AdminActor } from './admin-audit';

export async function manageAccount(
  actor: AdminActor,
  body: Record<string, unknown>,
) {
  if (!isAdministrator(actor))
    throw new RequestError('Только администратор управляет аккаунтами', 403);
  const userId = databaseId(body.userId);
  if (userId === actor.id)
    throw new RequestError(
      'Нельзя менять собственные права, блокировать себя или отзывать свою сессию',
    );
  return db.transaction(async (tx) => {
    // Serializes account policy checks, including simultaneous demotions/session revocations.
    await tx.execute(sql`select pg_advisory_xact_lock(1808523042)`);
    const accounts = await tx
      .select()
      .from(users)
      .where(inArray(users.id, [actor.id, userId]))
      .orderBy(asc(users.id))
      .for('update');
    const current = accounts.find((u) => u.id === actor.id),
      target = accounts.find((u) => u.id === userId);
    if (!isAdministrator(current))
      throw new RequestError('Права администратора отозваны', 403);
    if (!target) throw new RequestError('Пользователь не найден', 404);
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length > 500)
      throw new RequestError('Причина — до 500 символов');
    const command = String(body.command || body.action);
    const patch: Partial<typeof users.$inferInsert> = {};
    const before = {
      role: target.role,
      isEditor: target.isEditor,
      isSuspended: target.isSuspended,
    };
    if (command === 'role') {
      if (!['visitor', 'vip', 'moderator', 'admin'].includes(String(body.role)))
        throw new RequestError('Неизвестная роль');
      if (target.role === body.role) return { ok: true, unchanged: true };
      if (target.isSuspended && body.role === 'admin')
        throw new RequestError('Сначала разблокируйте аккаунт');
      patch.role = String(body.role);
      patch.sessionVersion = target.sessionVersion + 1;
    } else if (command === 'editor') {
      if (typeof body.enabled !== 'boolean')
        throw new RequestError('Укажите состояние галочки редактора');
      if (target.isEditor === body.enabled)
        return { ok: true, unchanged: true };
      patch.isEditor = body.enabled;
    } else if (command === 'suspend') {
      if (typeof body.enabled !== 'boolean')
        throw new RequestError('Укажите состояние блокировки');
      if (target.role === 'admin')
        throw new RequestError(
          'Администратора нельзя блокировать. Сначала явно измените роль.',
        );
      if (target.isSuspended === body.enabled)
        return { ok: true, unchanged: true };
      if (body.enabled && !reason)
        throw new RequestError('Для блокировки обязательна причина');
      patch.isSuspended = body.enabled;
      patch.suspensionReason = body.enabled ? reason : null;
      patch.sessionVersion = target.sessionVersion + 1;
    } else if (command === 'revokeSessions') {
      patch.sessionVersion = target.sessionVersion + 1;
    } else throw new RequestError('Неизвестное действие с аккаунтом');
    await tx.update(users).set(patch).where(eq(users.id, userId));
    await writeAdminAudit(
      tx,
      current!,
      `user.${command}`,
      'user',
      userId,
      `${target.username}: ${command}`,
      {
        before,
        after: {
          role: patch.role ?? target.role,
          isEditor: patch.isEditor ?? target.isEditor,
          isSuspended: patch.isSuspended ?? target.isSuspended,
        },
        reason,
      },
    );
    return { ok: true };
  });
}
export async function curateCatalogue(
  actor: AdminActor,
  body: Record<string, unknown>,
) {
  if (!isAdministrator(actor))
    throw new RequestError(
      'Кураторские настройки доступны только администратору',
      403,
    );
  const command = String(body.command);
  const rawIds = command === 'featured' ? body.ids : [body.movieId];
  if (!Array.isArray(rawIds) || !rawIds.length || rawIds.length > 50)
    throw new RequestError('Выберите от 1 до 50 материалов');
  const ids = [...new Set(rawIds.map((value) => databaseId(value)))].sort(
    (a, b) => a - b,
  );
  if (command === 'featured' && typeof body.enabled !== 'boolean')
    throw new RequestError('Укажите состояние витрины');
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(1808523043)`);
    const [current] = await tx
      .select()
      .from(users)
      .where(eq(users.id, actor.id));
    if (!isAdministrator(current))
      throw new RequestError('Недостаточно прав', 403);
    const films = await tx
      .select({ id: movies.id, title: movies.title, featured: movies.featured })
      .from(movies)
      .where(inArray(movies.id, ids))
      .orderBy(asc(movies.id))
      .for('update');
    if (films.length !== ids.length)
      throw new RequestError(
        'Один из материалов уже удалён. Обновите список.',
        404,
      );
    if (command === 'featured') {
      for (const film of films) {
        if (Boolean(film.featured) === body.enabled) continue;
        await tx
          .update(movies)
          .set({ featured: body.enabled as boolean })
          .where(eq(movies.id, film.id));
        await writeAdminAudit(
          tx,
          current!,
          'movie.featured',
          'movie',
          film.id,
          film.title,
          { before: Boolean(film.featured), after: body.enabled },
        );
      }
    } else if (command === 'club') {
      const date = new Date();
      const monday = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      );
      monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
      await tx
        .update(movieClub)
        .set({ active: false })
        .where(eq(movieClub.active, true));
      await tx.insert(movieClub).values({
        movieId: ids[0],
        weekStart: monday.toISOString().slice(0, 10),
        active: true,
      });
      await writeAdminAudit(
        tx,
        current!,
        'movie.club',
        'movie',
        ids[0],
        films[0].title,
      );
      // Reuse movie invalidation, even though this title's content did not change.
      await tx.execute(
        sql`insert into mg_realtime_versions(audience_id,revision) values(0,1) on conflict(audience_id) do update set revision=mg_realtime_versions.revision+1`,
      );
    } else throw new RequestError('Неизвестное действие с каталогом');
    return { ok: true, affected: ids.length };
  });
}
