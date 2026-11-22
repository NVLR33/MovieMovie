import { and, eq } from 'drizzle-orm';
import type { db } from '@/db';
import { moviePioneers, watches, hiddenAchievementEvents } from '@/db/schema';
import { awardHiddenTrophy } from './hidden-achievements';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Call BEFORE the first watch insert, with user -> movie row locks already held. */
export async function recordFirstViewer(tx: Transaction, userId: number, movieId: number) {
  const [prior] = await tx.select({ id: watches.id }).from(watches).where(eq(watches.movieId, movieId)).limit(1);
  const [event] = await tx.select({ id: hiddenAchievementEvents.id }).from(hiddenAchievementEvents)
    .where(and(eq(hiddenAchievementEvents.movieId, movieId), eq(hiddenAchievementEvents.kind, 'watch'))).limit(1);
  await tx.insert(moviePioneers).values({ movieId, userId: prior || event ? null : userId })
    .onConflictDoNothing({ target: moviePioneers.movieId });
}

/** Only post-discovery ratings and meaningful top-level reviews count; no XP is minted. */
export async function recordPioneerActivity(tx: Transaction, userId: number, movieId: number, kind: 'rated' | 'reviewed', timeZone: string) {
  const [pioneer] = await tx.update(moviePioneers).set({ [kind]: true })
    .where(and(eq(moviePioneers.movieId, movieId), eq(moviePioneers.userId, userId)))
    .returning({ rated: moviePioneers.rated, reviewed: moviePioneers.reviewed });
  if (!pioneer?.rated || !pioneer.reviewed) return null;
  return awardHiddenTrophy(tx, userId, 'pioneer', new Date(), timeZone);
}
