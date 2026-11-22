import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { movies, watches, ratings, comments, users, userTitleAwards } from '@/db/schema';
import { calculateUserTitleProgress, titleCollection, type UserTitleCollection } from './user-titles';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function loadUserTitles(tx: Transaction, userId: number, equipped: string | null): Promise<UserTitleCollection> {
  const [films, watched, rated, reviews, awards] = await Promise.all([
    tx.select({ id: movies.id, category: movies.category, franchise: movies.franchise, festivalRecognized: movies.festivalRecognized }).from(movies),
    tx.select({ movieId: watches.movieId }).from(watches).where(eq(watches.userId, userId)),
    tx.select({ movieId: ratings.movieId, value: ratings.value }).from(ratings).where(eq(ratings.userId, userId)),
    tx.select({ movieId: comments.movieId, body: comments.body, parentId: comments.parentId, spoiler: comments.spoiler }).from(comments).where(eq(comments.userId, userId)),
    tx.select({ titleId: userTitleAwards.titleId }).from(userTitleAwards).where(eq(userTitleAwards.userId, userId)),
  ]);
  return titleCollection(calculateUserTitleProgress({ films, watches: watched, ratings: rated, comments: reviews }), awards.map(award => award.titleId), equipped);
}

/** Caller holds the user's row lock. Persist earned titles atomically with qualifying activity. */
export async function syncUserTitles(tx: Transaction, userId: number) {
  const collection = await loadUserTitles(tx, userId, null);
  const unlocked = collection.options.filter(option => option.unlocked);
  if (unlocked.length) await tx.insert(userTitleAwards).values(unlocked.map(option => ({ userId, titleId: option.id }))).onConflictDoNothing();
}

export async function equipUserTitle(userId: number, requested: unknown) {
  if (requested !== null && typeof requested !== 'string') throw Error('Некорректный титул');
  return db.transaction(async tx => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
    const collection = await loadUserTitles(tx, userId, null);
    if (requested !== null && requested !== 'none' && !collection.options.some(option => option.id === requested && option.unlocked)) {
      throw Error('Этот титул ещё не получен');
    }
    // Persist exactly the qualifying snapshot used for validation, rather than re-reading a changing catalog.
    const unlocked = collection.options.filter(option => option.unlocked);
    if (unlocked.length) await tx.insert(userTitleAwards).values(unlocked.map(option => ({ userId, titleId: option.id }))).onConflictDoNothing();
    await tx.update(users).set({ equippedTitle: requested }).where(eq(users.id, userId));
  });
}
