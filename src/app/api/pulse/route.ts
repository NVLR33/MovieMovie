import { NextResponse } from 'next/server';
import { and, eq, gte, lte, desc, asc, sql } from 'drizzle-orm';
import { getOverview, db, users, watches } from '@/lib/data';
import { rankWeeklyPulse } from '@/lib/weekly-pulse';

export const dynamic = 'force-dynamic';
// Public refresh slice. Never loads private messages/notifications or every user's history.
export async function GET() {
  try {
    const now = new Date(),
      since = new Date(now.getTime() - 7 * 86400000);
    const count = sql<number>`count(*)::int`;
    const [films, leaders, pulseCounts] = await Promise.all([
      getOverview(),
      db
        .select({
          id: users.id,
          username: users.username,
          avatar: users.avatar,
          xp: users.xp,
          watches: count,
        })
        .from(watches)
        .innerJoin(users, eq(users.id, watches.userId))
        .where(and(gte(watches.watchedAt, since), lte(watches.watchedAt, now)))
        .groupBy(users.id)
        .orderBy(desc(count), asc(users.id))
        .limit(3),
      db
        .select({
          movieId: watches.movieId,
          viewers: sql<number>`count(distinct ${watches.userId})::int`,
        })
        .from(watches)
        .where(and(gte(watches.watchedAt, since), lte(watches.watchedAt, now)))
        .groupBy(watches.movieId),
    ]);
    return NextResponse.json(
      {
        films,
        weeklyPulse: rankWeeklyPulse(films, pulseCounts, now),
        weeklyLeaders: leaders.map(({ xp, ...leader }) => ({
          ...leader,
          level: Math.floor(Math.max(0, xp || 0) / 500) + 1,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'Не удалось обновить Кинопульс' },
      { status: 503 },
    );
  }
}
