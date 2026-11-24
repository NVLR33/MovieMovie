export type WeeklyPulse = {
  since: string;
  until: string;
  entries: { movieId: number; viewers: number }[];
};
type PulseFilm = { id: number; rating: number; ratingCount: number };
export function pulsePeriod(now: Date = new Date()) {
  return {
    since: new Date(now.getTime() - 7 * 86400000).toISOString(),
    until: now.toISOString(),
  };
}
/** Public aggregate only: no user IDs or personal watch histories in the snapshot. */
export function rankWeeklyPulse(
  films: readonly PulseFilm[],
  counts: readonly { movieId: number; viewers: number }[],
  now: Date = new Date(),
): WeeklyPulse {
  const index = new Map(films.map((film) => [film.id, film])),
    unique = new Map<number, number>();
  for (const count of counts)
    if (
      index.has(count.movieId) &&
      Number.isSafeInteger(count.viewers) &&
      count.viewers > 0
    )
      unique.set(
        count.movieId,
        Math.max(unique.get(count.movieId) || 0, count.viewers),
      );
  const score = (id: number) => {
    const film = index.get(id)!;
    return film.ratingCount > 0 && Number.isFinite(film.rating)
      ? film.rating
      : 0;
  };
  const entries = [...unique]
    .map(([movieId, viewers]) => ({ movieId, viewers }))
    .sort(
      (a, b) =>
        b.viewers - a.viewers ||
        score(b.movieId) - score(a.movieId) ||
        index.get(b.movieId)!.ratingCount - index.get(a.movieId)!.ratingCount ||
        a.movieId - b.movieId,
    )
    .slice(0, 10);
  return { ...pulsePeriod(now), entries };
}
export function buildWeeklyPulse(
  films: readonly PulseFilm[],
  watches: readonly {
    movieId: number;
    userId: number;
    watchedAt: Date | string;
  }[],
  now: Date = new Date(),
): WeeklyPulse {
  const until = now.getTime(),
    since = until - 7 * 86400000,
    viewers = new Map<number, Set<number>>();
  for (const watch of watches) {
    const time = new Date(watch.watchedAt).getTime();
    if (!Number.isFinite(time) || time < since || time > until) continue;
    const users = viewers.get(watch.movieId) || new Set<number>();
    users.add(watch.userId);
    viewers.set(watch.movieId, users);
  }
  return rankWeeklyPulse(
    films,
    [...viewers].map(([movieId, users]) => ({ movieId, viewers: users.size })),
    now,
  );
}
