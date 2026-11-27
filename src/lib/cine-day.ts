import { catalogTokens } from "./catalog-filter";

export type CineDay = {
  label: string;
  filter: string;
  icon: string;
  href: string;
  count: number;
};
export const CINE_DAY_TIME_ZONE = "Europe/Moscow";
export function cineDayKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CINE_DAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
/** Actual genre tokens only. Each title contributes at most once to a tag. */
export function catalogDayTags(
  films: readonly { genre?: string | null }[],
): CineDay[] {
  const tags = new Map<string, { label: string; count: number }>();
  for (const film of films) {
    const seen = new Set<string>();
    for (const label of catalogTokens(film.genre)) {
      const key = label.toLocaleLowerCase("ru");
      if (key === "все жанры" || seen.has(key)) continue;
      seen.add(key);
      const tag = tags.get(key);
      if (tag) {
        tag.count++;
        if (label < tag.label) tag.label = label;
      } else tags.set(key, { label, count: 1 });
    }
  }
  return [...tags.values()].map(({ label, count }) => ({
    label,
    filter: label,
    icon: "🎬",
    href: "/catalog?" + new URLSearchParams({ genre: label }),
    count,
  }));
}
function hash(value: string) {
  let n = 2166136261;
  for (const char of value) {
    n ^= char.codePointAt(0)!;
    n = Math.imul(n, 16777619);
  }
  return n >>> 0;
}
/** Seeded catalog rotation: same day for everyone; no adjacent repeat with a stable pool.
 * A shuffled tag cycle avoids popularity weighting and repeat/refresh rerolls. No user tracking.
 * Catalog edits may change the pool; removed tags must never link to an empty collection.
 */
export function dailyCatalogDay(
  tags: readonly CineDay[],
  now = new Date(),
): CineDay | null {
  if (!tags.length) return null;
  const pool = [...tags].sort(
    (a, b) =>
      hash("moviemovie-daily-v3:" + a.filter.toLocaleLowerCase("ru")) -
        hash("moviemovie-daily-v3:" + b.filter.toLocaleLowerCase("ru")) ||
      a.filter.localeCompare(b.filter, "ru"),
  );
  const day = Math.floor(Date.parse(cineDayKey(now) + "T00:00:00Z") / 86400000);
  return pool[((day % pool.length) + pool.length) % pool.length];
}
