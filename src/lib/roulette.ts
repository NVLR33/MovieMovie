import { catalogTokens } from './catalog-filter';

export const ROULETTE_MODES = [
  'surprise',
  'unwatched',
  'watchlist',
  'evening',
] as const;
export type RouletteMode = (typeof ROULETTE_MODES)[number];
export type RouletteMaterial = {
  id: number;
  category: string;
  genre: string;
  duration: number;
  rating: number;
  ratingCount: number;
};
export type RouletteFilters = {
  category: string;
  genre: string;
  minRating: number;
  maxMinutes: number;
};
export const DEFAULT_ROULETTE_FILTERS: RouletteFilters = {
  category: 'all',
  genre: 'all',
  minRating: 0,
  maxMinutes: 120,
};
const features = new Set(['Фильм', 'Мультфильм', 'Аниме-фильм']);
export function roulettePool<T extends RouletteMaterial>(
  films: readonly T[],
  mode: RouletteMode,
  filters: RouletteFilters,
  watched: ReadonlySet<number>,
  saved: ReadonlySet<number>,
  signedIn: boolean,
): T[] {
  if (!signedIn && (mode === 'unwatched' || mode === 'watchlist')) return [];
  const seen = new Set<number>();
  return films.filter((film) => {
    if (seen.has(film.id)) return false;
    seen.add(film.id);
    return (
      (filters.category === 'all' || film.category === filters.category) &&
      (filters.genre === 'all' ||
        catalogTokens(film.genre).some(
          (genre) =>
            genre.toLocaleLowerCase() === filters.genre.toLocaleLowerCase(),
        )) &&
      (!filters.minRating ||
        (film.ratingCount > 0 && film.rating >= filters.minRating)) &&
      (mode !== 'unwatched' || !watched.has(film.id)) &&
      (mode !== 'watchlist' || saved.has(film.id)) &&
      (mode !== 'evening' ||
        (features.has(film.category) &&
          Number.isFinite(film.duration) &&
          film.duration > 0 &&
          film.duration <= filters.maxMinutes))
    );
  });
}
/** Uniform among unseen candidates; after a cycle, avoid the last result if possible. */
export function pickRoulette<T extends { id: number }>(
  pool: readonly T[],
  history: readonly number[],
  random = Math.random,
): T | null {
  if (!pool.length) return null;
  const seen = new Set(history);
  let candidates = pool.filter((film) => !seen.has(film.id));
  if (!candidates.length)
    candidates =
      pool.length > 1
        ? pool.filter((film) => film.id !== history.at(-1))
        : [...pool];
  const value = random();
  return candidates[
    Math.max(
      0,
      Math.min(
        candidates.length - 1,
        Math.floor((Number.isFinite(value) ? value : 0) * candidates.length),
      ),
    )
  ];
}
export const ROULETTE_WINNER_INDEX = 28;
export function rouletteStrip<T>(
  pool: readonly T[],
  winner: T,
  random = Math.random,
): T[] {
  if (!pool.length) return [];
  const items = Array.from(
    { length: 34 },
    () =>
      pool[
        Math.max(
          0,
          Math.min(pool.length - 1, Math.floor(random() * pool.length)),
        )
      ],
  );
  items[ROULETTE_WINNER_INDEX] = winner;
  return items;
}
