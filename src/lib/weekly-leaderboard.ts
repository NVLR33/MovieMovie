const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type WeeklyPerson = { id: number; username: string; avatar: string | null; xp: number | null };
type DatedWatch = { userId: number; watchedAt: Date | string };
export type WeeklyLeader = {
  id: number;
  username: string;
  avatar: string | null;
  level: number;
  watches: number;
};

/** Rolling seven days, calculated on the server. Expose counts, never watch histories. */
export function getWeeklyLeaders(
  people: readonly WeeklyPerson[],
  watches: readonly DatedWatch[],
  now = new Date(),
): WeeklyLeader[] {
  const end = now.getTime();
  const start = end - WEEK_MS;
  const counts = new Map<number, number>();
  for (const watch of watches) {
    const at = new Date(watch.watchedAt).getTime();
    if (at >= start && at <= end) counts.set(watch.userId, (counts.get(watch.userId) || 0) + 1);
  }
  return people.flatMap(person => {
    const count = counts.get(person.id) || 0;
    if (!count) return [];
    return [{
      id: person.id,
      username: person.username,
      avatar: person.avatar,
      level: Math.floor(Math.max(0, person.xp || 0) / 500) + 1,
      watches: count,
    }];
  }).sort((a, b) => b.watches - a.watches || a.id - b.id).slice(0, 3);
}
