import { writeAdminAudit } from './admin-audit';
import { canModerate } from './permissions';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { movieSuggestions, movies, notifications, users } from '@/db/schema';
import { awardPetActivity } from './cinema-pet-server';
import { materialIdentity, parseMaterialInput, type MaterialInput } from './material-input';
import { databaseId, RequestError } from './request-validation';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Actor = { id: number; role: string; username: string };
/** Shared with direct movie creation to serialize case-insensitive title/year/category duplicates. */
export async function lockMaterial(tx: Transaction, material: Pick<MaterialInput, 'title' | 'year' | 'category'>) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${materialIdentity(material)}))`);
}
export async function existingMaterial(tx: Transaction, material: Pick<MaterialInput, 'title' | 'year' | 'category'>) {
  const [film] = await tx.select({ id: movies.id }).from(movies).where(and(
    sql`lower(trim(${movies.title})) = ${material.title.trim().toLowerCase()}`, eq(movies.year, material.year), eq(movies.category, material.category)
  )).limit(1);
  return film;
}
export async function handleMovieSuggestion(actor: Actor, body: Record<string, unknown>) {
  if (body.action === 'suggestMovie') {
    const input = parseMaterialInput(body);
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
    if (comment.length > 1000) throw new RequestError('Комментарий — не более 1000 символов');
    return db.transaction(async tx => {
      // Serialize this author's limit and catalogue rewards across concurrent requests.
      await tx.select({ id: users.id }).from(users).where(eq(users.id, actor.id)).for('update');
      await lockMaterial(tx, input);
      const pending = await tx.select({ id: movieSuggestions.id }).from(movieSuggestions).where(and(eq(movieSuggestions.userId, actor.id), eq(movieSuggestions.status, 'pending')));
      if (pending.length >= 5) throw new RequestError('У вас уже 5 предложений на рассмотрении');
      if (await existingMaterial(tx, input)) throw new RequestError('Такой материал уже есть в каталоге', 409);
      const [duplicate] = await tx.select({ id: movieSuggestions.id }).from(movieSuggestions).where(and(
        sql`lower(trim(${movieSuggestions.title})) = ${input.title.toLowerCase()}`, eq(movieSuggestions.year, input.year), eq(movieSuggestions.category, input.category), eq(movieSuggestions.status, 'pending')
      )).limit(1);
      if (duplicate) throw new RequestError('Этот материал уже находится на рассмотрении', 409);
      const [suggestion] = await tx.insert(movieSuggestions).values({ userId: actor.id, title: input.title, year: input.year, genre: input.genre, category: input.category, material: input, comment: comment || null }).returning({ id: movieSuggestions.id });
      const moderators = await tx.select({ id: users.id }).from(users).where(sql`${users.role} IN ('admin','moderator')`);
      if (moderators.length) await tx.insert(notifications).values(moderators.map(mod => ({ userId: mod.id, actorId: actor.id, message: `🎬 ${actor.username} предложил(а) «${input.title}»`, link: '/admin?tab=suggestions' })));
      return { ok: true, suggestionId: suggestion.id };
    });
  }
  if (!['admin', 'moderator'].includes(actor.role)) throw new RequestError('Недостаточно прав', 403);
  const id = databaseId(body.id);
  const [initial] = await db.select({ userId: movieSuggestions.userId }).from(movieSuggestions).where(eq(movieSuggestions.id, id));
  if (!initial) throw new RequestError('Предложение не найдено', 404);
  return db.transaction(async tx => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, initial.userId)).for('update');
    const [current] = await tx.select().from(users).where(eq(users.id,actor.id));
    if (!canModerate(current)) throw new RequestError('Недостаточно прав',403);
    const [suggestion] = await tx.select().from(movieSuggestions).where(eq(movieSuggestions.id, id)).for('update');
    if (!suggestion) throw new RequestError('Предложение не найдено', 404);
    if (suggestion.status === 'approved' && body.action === 'approveSuggestion') return { ok: true, movieId: suggestion.movieId, alreadyReviewed: true };
    if (suggestion.status !== 'pending') throw new RequestError('Предложение уже рассмотрено', 409);
    if (body.action === 'rejectSuggestion') {
      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
      if (!reason || reason.length > 500) throw new RequestError('Укажите причину отклонения (до 500 символов)');
      await tx.update(movieSuggestions).set({ status: 'rejected', reviewedBy: actor.id, reviewedAt: new Date(), reviewReason: reason }).where(eq(movieSuggestions.id, id));
      await tx.insert(notifications).values({ userId: suggestion.userId, actorId: actor.id, message: `Предложение «${suggestion.title}» отклонено: ${reason}`, link: '/catalog?suggestions=mine' });
      await writeAdminAudit(tx,actor,'suggestion.reject','suggestion',id,suggestion.title,{reason});
      return { ok: true, rejected: true };
    }
    let movieId: number;
    let material = suggestion.material;
    let created = false;
    // Compatibility: a legacy proposal can be explicitly linked to an existing matching title.
    if (body.movieId !== undefined) {
      movieId = databaseId(body.movieId);
      const [film] = await tx.select().from(movies).where(eq(movies.id, movieId));
      if (!film || film.year !== suggestion.year || film.category !== suggestion.category || film.title.trim().toLowerCase() !== suggestion.title.trim().toLowerCase()) throw new RequestError('Материал должен совпадать с предложением по названию, году и категории');
    } else {
      const raw = body.material ?? suggestion.material;
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new RequestError('Старая заявка: дополните данные перед публикацией');
      material = parseMaterialInput(raw as Record<string, unknown>);
      await lockMaterial(tx, material);
      const existing = await existingMaterial(tx, material);
      if (existing) throw new RequestError('Материал уже есть в каталоге. Свяжите заявку с существующим материалом вместо повторной публикации.', 409);
      const [film] = await tx.insert(movies).values(material).returning({ id: movies.id });
      movieId = film.id;
      created = true;
    }
    await tx.update(movieSuggestions).set({ status: 'approved', movieId, material, reviewedBy: actor.id, reviewedAt: new Date(), reviewReason: null }).where(eq(movieSuggestions.id, id));
    await writeAdminAudit(tx,actor,'suggestion.approve','suggestion',id,suggestion.title,{movieId,created});
    await awardPetActivity(tx, suggestion.userId, 'catalog', movieId);
    await tx.insert(notifications).values({ userId: suggestion.userId, actorId: actor.id, message: `🎬 Предложение «${suggestion.title}» принято! Награда проверена с учётом дневного лимита.`, link: `/movie/${movieId}` });
    return { ok: true, movieId, created };
  });
}
