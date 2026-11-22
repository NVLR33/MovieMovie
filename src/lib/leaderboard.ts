export const LEADERBOARD_LIMITS = [1, 3, 5, 10, 25, 50, 100] as const;
export type LeaderboardLimit = (typeof LEADERBOARD_LIMITS)[number];

export const LEADERBOARD_METRICS = {
  minutes: 'Часы просмотра',
  watches: 'Просмотры',
  streak: 'Активные дни',
  xp: 'Опыт XP',
  ratings: 'Оценки',
  gameScore: 'Игровые очки',
} as const;
export type LeaderboardMetric = keyof typeof LEADERBOARD_METRICS;

type LeaderboardScores = { id: number } & Record<LeaderboardMetric, number | null>;

export function getTopLeaders<T extends LeaderboardScores>(
  leaders: readonly T[],
  metric: LeaderboardMetric,
  limit: LeaderboardLimit,
): T[] {
  // Rank the entire community before applying the limit. IDs give ties a stable order.
  return [...leaders]
    .sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0) || a.id - b.id)
    .slice(0, limit);
}

export function getLeaderboardPodium<T>(leaders: readonly T[]) {
  // Retain the familiar silver / gold / bronze layout, including top-1 and small communities.
  return ([2, 1, 3] as const).flatMap(place => {
    const person = leaders[place - 1];
    return person === undefined ? [] : [{ person, place }];
  });
}
