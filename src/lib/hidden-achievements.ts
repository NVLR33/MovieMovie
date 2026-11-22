import { and, eq, sql } from 'drizzle-orm';
import type { db } from '@/db';
import { hiddenAchievementAwards, hiddenAchievementEvents, notifications } from '@/db/schema';
import { hiddenAchievementDefinitions, trophyCalendar } from './hidden-achievement-rules';
import type { HiddenAchievementId, UnlockedHiddenAchievement } from './hidden-achievement-types';
import { getOwnershipStats } from './ownership';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function awardHiddenTrophy(tx: Transaction, userId: number, id: HiddenAchievementId, now: Date, timeZone: string) {
  const [award] = await tx.insert(hiddenAchievementAwards).values({ userId, achievementId: id, unlockedAt: now, timeZone })
    .onConflictDoNothing({ target: [hiddenAchievementAwards.userId, hiddenAchievementAwards.achievementId] })
    .returning({ id: hiddenAchievementAwards.id });
  if (!award) return null;
  const definition = hiddenAchievementDefinitions[id];
  await tx.insert(notifications).values({
    userId, message: `${definition.icon} Скрытый трофей открыт: «${definition.name}»!`, link: '/achievements',
  });
  return { id, ...definition };
}

/** Caller holds the user's row lock; this event and both awards commit with the watch mutation. */
export async function recordTrophyWatch(tx: Transaction, userId: number, movieId: number, now: Date, timeZone: string) {
  const { hour, weekKey } = trophyCalendar(now, timeZone);
  const [event] = await tx.insert(hiddenAchievementEvents).values({ userId, movieId, kind: 'watch', occurredAt: now, timeZone, weekKey })
    .onConflictDoNothing({ target: [hiddenAchievementEvents.userId, hiddenAchievementEvents.kind, hiddenAchievementEvents.movieId] })
    .returning({ id: hiddenAchievementEvents.id });
  if (!event) return [];
  const unlocked = [];
  if (hour >= 3 && hour < 5) {
    const award = await awardHiddenTrophy(tx, userId, 'night_watch', now, timeZone);
    if (award) unlocked.push(award);
  }
  const [weekly] = await tx.select({ count: sql<number>`count(*)::int` }).from(hiddenAchievementEvents)
    .where(and(eq(hiddenAchievementEvents.userId, userId), eq(hiddenAchievementEvents.kind, 'watch'), eq(hiddenAchievementEvents.weekKey, weekKey)));
  if (weekly.count >= 7) {
    const award = await awardHiddenTrophy(tx, userId, 'steady_week', now, timeZone);
    if (award) unlocked.push(award);
  }
  return unlocked;
}

/** Serialize only the caller's unlocked trophies; no secret totals or locked metadata. */
export function visibleHiddenTrophies(
  awards: readonly { achievementId: string; unlockedAt: Date; timeZone: string }[],
  ownerCounts: readonly { achievementId: string; count: number }[], totalUsers: number,
): UnlockedHiddenAchievement[] {
  const counts = new Map(ownerCounts.map(row => [row.achievementId, row.count]));
  return awards.flatMap(award => {
    if (!Object.hasOwn(hiddenAchievementDefinitions, award.achievementId)) return [];
    const id = award.achievementId as HiddenAchievementId;
    return [{ id, ...hiddenAchievementDefinitions[id], unlockedAt: award.unlockedAt.toISOString(), timeZone: award.timeZone,
      community: getOwnershipStats(counts.get(id) || 0, totalUsers) }];
  });
}
