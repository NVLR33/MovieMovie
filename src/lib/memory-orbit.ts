export type MemoryFilm = {
  id: number;
  title: string;
  poster: string;
  year: number;
  category: string;
};
export type MemoryWatch = { movieId: number; watchedAt: string };
export type MemoryRating = { movieId: number; value: number };
export type MemoryReview = {
  id: number;
  movieId: number;
  parentId: number | null;
  body: string;
  spoiler?: boolean;
  createdAt: string;
  author: { id: number };
};
export type MemoryEntry = {
  film: MemoryFilm;
  timestamp: number | null;
  month: string;
  dateLabel: string;
  rating: number | null;
  kind: 'classic' | 'muted' | 'neutral';
  review: MemoryReview | null;
};
export function memoryMonthLabel(key: string) {
  return /^\d{4}-\d{2}$/.test(key)
    ? new Date(`${key}-01T12:00:00Z`).toLocaleDateString('ru-RU', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : 'Дата не указана';
}
export function buildMemories(
  films: readonly MemoryFilm[],
  watches: readonly MemoryWatch[],
  ratings: readonly MemoryRating[],
  comments: readonly MemoryReview[],
  userId: number,
): MemoryEntry[] {
  const filmMap = new Map(films.map((film) => [film.id, film]));
  const dates = new Map<number, number | null>();
  for (const watch of watches) {
    if (!filmMap.has(watch.movieId)) continue;
    const parsed = Date.parse(watch.watchedAt),
      time = Number.isFinite(parsed) ? parsed : null;
    if (
      !dates.has(watch.movieId) ||
      (time ?? -Infinity) > (dates.get(watch.movieId) ?? -Infinity)
    )
      dates.set(watch.movieId, time);
  }
  const scores = new Map(
    ratings.map((r) => [
      r.movieId,
      Number.isFinite(r.value) &&
      r.value >= 0.5 &&
      r.value <= 10 &&
      Number.isInteger(r.value * 2)
        ? r.value
        : null,
    ]),
  );
  const reviews = new Map<number, MemoryReview>();
  for (const review of comments) {
    if (review.author.id !== userId || review.parentId !== null) continue;
    const previous = reviews.get(review.movieId);
    if (
      !previous ||
      (Date.parse(review.createdAt) || 0) >
        (Date.parse(previous.createdAt) || 0)
    )
      reviews.set(review.movieId, review);
  }
  return [...dates]
    .map(([id, timestamp]) => {
      const film = filmMap.get(id)!,
        rating = scores.get(id) ?? null;
      return {
        film,
        timestamp,
        month:
          timestamp === null
            ? 'undated'
            : new Date(timestamp).toISOString().slice(0, 7),
        dateLabel:
          timestamp === null
            ? 'Дата отметки не указана'
            : new Date(timestamp).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              }),
        rating,
        kind:
          rating === 10
            ? ('classic' as const)
            : rating !== null && rating <= 4
              ? ('muted' as const)
              : ('neutral' as const),
        review: reviews.get(id) ?? null,
      };
    })
    .sort(
      (a, b) =>
        (b.timestamp ?? -Infinity) - (a.timestamp ?? -Infinity) ||
        b.film.id - a.film.id,
    );
}
export function filterMemories(
  entries: readonly MemoryEntry[],
  month: string,
  classics: boolean,
) {
  return entries.filter(
    (entry) =>
      (!month || entry.month === month) &&
      (!classics || entry.kind === 'classic'),
  );
}
/** Bounded spatial movement. Measure the stable slot, never the transformed poster itself. */
export function memoryDepth(center: number, viewport: number, mobile: boolean) {
  const distance = Math.min(
    1,
    Math.abs(center - viewport * 0.52) / Math.max(1, viewport * 0.8),
  );
  return {
    z: -distance * (mobile ? 48 : 145),
    tilt: (center < viewport * 0.52 ? 1 : -1) * distance * (mobile ? 2 : 5),
  };
}
