import { catalogTokens } from './catalog-filter';

export type CineDay = {
  label: string;
  filter: string;
  icon: string;
  href: string;
  count: number;
};

/** Actual genre tokens only. Each title contributes at most once to a tag. */
export function catalogDayTags(
  films: readonly { genre?: string | null }[],
): CineDay[] {
  const tags = new Map<string, { label: string; count: number }>();
  for (const film of films) {
    const seen = new Set<string>();
    for (const label of catalogTokens(film.genre)) {
      const key = label.toLocaleLowerCase();
      if (key === 'все жанры' || seen.has(key)) continue;
      seen.add(key);
      const tag = tags.get(key);
      if (tag) tag.count++;
      else tags.set(key, { label, count: 1 });
    }
  }
  return [...tags.values()].map(({ label, count }) => ({
    label,
    filter: label,
    icon: '🎬',
    href: '/catalog?' + new URLSearchParams({ genre: label }),
    count,
  }));
}

/** Uniform by tag, not by title popularity; explicit rerolls avoid the current tag. */
export function randomCatalogDay(
  tags: readonly CineDay[],
  previous?: string,
  random = Math.random,
): CineDay | null {
  const pool =
    tags.length > 1 ? tags.filter((tag) => tag.filter !== previous) : tags;
  if (!pool.length) return null;
  const value = random();
  const index = Math.max(
    0,
    Math.min(
      pool.length - 1,
      Math.floor((Number.isFinite(value) ? value : 0) * pool.length),
    ),
  );
  return pool[index];
}
