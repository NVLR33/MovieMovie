import { movieReadFields } from '@/lib/movie-read-fields';
import { writeAdminAudit } from '@/lib/admin-audit';
import { canModerate } from '@/lib/permissions';
import { readJsonObject, RequestError, requestFailure } from '@/lib/request-validation';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gt, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { getUser } from '@/lib/auth';
import { users, movies, seriesSeasons, seriesEpisodes, seasonRatings, episodeRatings, seriesCompletions } from '@/db/schema';
import { isSeries, validSeriesRating } from '@/lib/series';
import { loadSeries, syncSeriesCompletion } from '@/lib/series-server';

class InputError extends Error {}
function positive(value: unknown, max = 2147483647) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > max) throw new InputError('Некорректный номер или ID');
  return value;
}
function title(value: unknown) {
  if (typeof value !== 'string' || value.length > 160) throw new InputError('Название должно быть не длиннее 160 символов');
  return value.trim();
}
function failure(error: unknown) {
  if (error instanceof RequestError) return requestFailure(error);
  if (error instanceof SyntaxError) return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 });
  if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
  console.error('Series API:', error);
  return NextResponse.json({ error: 'Не удалось обработать сериал. Проверьте подключение и миграции базы.' }, { status: 500 });
}

export async function GET(req: NextRequest) {
  try {
    const movieId = positive(Number(req.nextUrl.searchParams.get('movieId')));
    const [film] = await db.select(movieReadFields).from(movies).where(eq(movies.id, movieId)).limit(1);
    if (!film || !isSeries(film.category)) return NextResponse.json({ error: 'Сериал не найден' }, { status: 404 });
    const user = await getUser();
    const seasons = await loadSeries(db, movieId, user?.id ?? null);
    const [completion] = user ? await db.select({ id: seriesCompletions.id }).from(seriesCompletions)
      .where(and(eq(seriesCompletions.userId, user.id), eq(seriesCompletions.movieId, movieId))).limit(1) : [];
    return NextResponse.json({ seasons, catalogComplete: film.seriesCatalogComplete, completed: Boolean(completion), canEdit: canModerate(user), authenticated: Boolean(user) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return failure(error); }
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Войдите в аккаунт' }, { status: 401 });
  try {
    const body = await readJsonObject(req);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InputError('Некорректный запрос');
    const movieId = positive(body.movieId);
    const action = String(body.action || '');
    const editing = ['saveSeason', 'deleteSeason', 'saveEpisode', 'publish'].includes(action);
    if (editing && !canModerate(user)) return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    let newlyCompleted = false;
    await db.transaction(async tx => {
      // Same lock order as watch/rate/comment. Editors and viewers serialize per title.
      await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for('update');
      if (editing) {
        const [current] = await tx.select().from(users).where(eq(users.id,user.id));
        if (!canModerate(current)) throw new RequestError('Недостаточно прав',403);
      }
      const [film] = await tx.select(movieReadFields).from(movies).where(eq(movies.id, movieId)).for('update');
      if (!film || !isSeries(film.category)) throw new InputError('Сериал не найден');
      if (action === 'rateSeason' || action === 'rateEpisode') {
        const id = positive(body.id);
        const value = body.value;
        if (value !== null && !validSeriesRating(value)) throw new InputError('Оценка: от 0.5 до 10 с шагом 0.5');
        if (action === 'rateSeason') {
          const [season] = await tx.select({ id: seriesSeasons.id }).from(seriesSeasons).where(and(eq(seriesSeasons.id, id), eq(seriesSeasons.movieId, movieId)));
          if (!season) throw new InputError('Сезон не найден в этом сериале');
          if (value === null) await tx.delete(seasonRatings).where(and(eq(seasonRatings.userId, user.id), eq(seasonRatings.seasonId, id)));
          else await tx.insert(seasonRatings).values({ userId: user.id, seasonId: id, value }).onConflictDoUpdate({ target: [seasonRatings.userId, seasonRatings.seasonId], set: { value } });
        } else {
          const [episode] = await tx.select({ id: seriesEpisodes.id }).from(seriesEpisodes).innerJoin(seriesSeasons, eq(seriesEpisodes.seasonId, seriesSeasons.id))
            .where(and(eq(seriesEpisodes.id, id), eq(seriesSeasons.movieId, movieId)));
          if (!episode) throw new InputError('Эпизод не найден в этом сериале');
          if (value === null) await tx.delete(episodeRatings).where(and(eq(episodeRatings.userId, user.id), eq(episodeRatings.episodeId, id)));
          else await tx.insert(episodeRatings).values({ userId: user.id, episodeId: id, value }).onConflictDoUpdate({ target: [episodeRatings.userId, episodeRatings.episodeId], set: { value } });
        }
        if (value !== null) newlyCompleted = await syncSeriesCompletion(tx, user.id, movieId, film.seriesCatalogComplete);
      } else if (action === 'saveSeason') {
        const number = positive(body.number, 100), episodeCount = positive(body.episodeCount, 100), seasonTitle = title(body.title);
        let id: number;
        if (body.id !== undefined) {
          id = positive(body.id);
          const [duplicate] = await tx.select({ id: seriesSeasons.id }).from(seriesSeasons).where(and(eq(seriesSeasons.movieId, movieId), eq(seriesSeasons.number, number), ne(seriesSeasons.id, id)));
          if (duplicate) throw new InputError('Сезон с таким номером уже существует');
          const changed = await tx.update(seriesSeasons).set({ number, title: seasonTitle }).where(and(eq(seriesSeasons.id, id), eq(seriesSeasons.movieId, movieId))).returning({ id: seriesSeasons.id });
          if (!changed.length) throw new InputError('Сезон не найден');
        } else {
          const [duplicate] = await tx.select({ id: seriesSeasons.id }).from(seriesSeasons).where(and(eq(seriesSeasons.movieId, movieId), eq(seriesSeasons.number, number)));
          if (duplicate) throw new InputError('Сезон с таким номером уже существует');
          const [season] = await tx.insert(seriesSeasons).values({ movieId, number, title: seasonTitle }).returning({ id: seriesSeasons.id });
          id = season.id;
        }
        await tx.delete(seriesEpisodes).where(and(eq(seriesEpisodes.seasonId, id), gt(seriesEpisodes.number, episodeCount)));
        await tx.insert(seriesEpisodes).values(Array.from({ length: episodeCount }, (_, i) => ({ seasonId: id, number: i + 1 }))).onConflictDoNothing();
      } else if (action === 'deleteSeason') {
        const removed = await tx.delete(seriesSeasons).where(and(eq(seriesSeasons.id, positive(body.id)), eq(seriesSeasons.movieId, movieId))).returning({ id: seriesSeasons.id });
        if (!removed.length) throw new InputError('Сезон не найден');
      } else if (action === 'saveEpisode') {
        const id = positive(body.id);
        const [episode] = await tx.select({ id: seriesEpisodes.id }).from(seriesEpisodes).innerJoin(seriesSeasons, eq(seriesEpisodes.seasonId, seriesSeasons.id))
          .where(and(eq(seriesEpisodes.id, id), eq(seriesSeasons.movieId, movieId)));
        if (!episode) throw new InputError('Эпизод не найден');
        await tx.update(seriesEpisodes).set({ title: title(body.title) }).where(eq(seriesEpisodes.id, id));
      } else if (action === 'publish') {
        if (typeof body.complete !== 'boolean') throw new InputError('Укажите полноту списка');
        const seasons = await loadSeries(tx, movieId, null);
        if (body.complete && (!seasons.length || seasons.some((s, i) => s.number !== i + 1 || !s.episodes.length || s.episodes.some((e, j) => e.number !== j + 1)))) throw new InputError('Нужны все сезоны и серии подряд, начиная с 1');
        await tx.update(movies).set({ seriesCatalogComplete: body.complete }).where(eq(movies.id, movieId));
      } else throw new InputError('Неизвестное действие');
      if (editing) await writeAdminAudit(tx,user,`series.${action}`,'movie',movieId,film.title);
      if (editing && action !== 'publish') {
        const [count] = await tx.select({ value: sql<number>`count(*)::int` }).from(seriesEpisodes).innerJoin(seriesSeasons, eq(seriesEpisodes.seasonId, seriesSeasons.id)).where(eq(seriesSeasons.movieId, movieId));
        await tx.update(movies).set({ seriesCatalogComplete: false, episodes: count.value }).where(eq(movies.id, movieId));
      }
    });
    return NextResponse.json({ ok: true, newlyCompleted });
  } catch (error) { return failure(error); }
}
