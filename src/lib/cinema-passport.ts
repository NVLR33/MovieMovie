import { buildCountryIndex, parseFilmCountries } from './cinema-countries';
import { USER_TITLE_DEFS } from './user-titles';

export type PassportFilm = {
  id: number;
  title: string;
  genre: string;
  country: string | null;
  poster: string;
  year: number;
};
export type PassportWatch = { movieId: number; watchedAt: string };
const DAY = 86_400_000;
export const utcDay = (time: number) => Math.floor(time / DAY);
export function passportStats<T extends PassportFilm>(
  films: readonly T[],
  watches: readonly PassportWatch[],
  now: number,
) {
  const today = utcDay(now),
    dates = new Map<number, number>();
  for (const watch of watches) {
    const time = Date.parse(watch.watchedAt);
    if (!Number.isFinite(time) || time > now) continue;
    dates.set(
      watch.movieId,
      Math.max(dates.get(watch.movieId) ?? -Infinity, time),
    );
  }
  const watched = [
    ...new Map(
      films.filter((film) => dates.has(film.id)).map((film) => [film.id, film]),
    ).values(),
  ];
  const days = [...new Set([...dates.values()].map(utcDay))].sort(
    (a, b) => a - b,
  );
  const daySet = new Set(days);
  let streak = 0,
    best = 0,
    run = 0,
    previous = -Infinity;
  for (const day of days) {
    run = day === previous + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  let cursor = daySet.has(today) ? today : today - 1;
  while (daySet.has(cursor)) {
    streak++;
    cursor--;
  }
  const date = new Date(now),
    monthStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  const monthly = watched.filter((film) => dates.get(film.id)! >= monthStart);
  const genres = new Map<
    string,
    { name: string; count: number; weight: number }
  >();
  let classified = 0;
  for (const film of monthly) {
    const names = [
      ...new Set(
        film.genre
          .split(/[,;]+/)
          .map((g) => g.trim())
          .filter(Boolean),
      ),
    ];
    if (!names.length) continue;
    classified++;
    for (const name of names) {
      const entry = genres.get(name) ?? { name, count: 0, weight: 0 };
      entry.count++;
      entry.weight += 1 / names.length;
      genres.set(name, entry);
    }
  }
  const rankedGenres = [...genres.values()]
    .map((g) => ({ ...g, percent: (g.weight / classified) * 100 }))
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name, 'ru'));
  const countries = buildCountryIndex(watched);
  const seen = new Set(watched.map((f) => f.id));
  // A real, available title from a country not yet visited. No invented recommendation score.
  const discovery =
    [...films]
      .sort((a, b) => a.id - b.id)
      .find(
        (film) =>
          !seen.has(film.id) &&
          parseFilmCountries(film.country).codes.some(
            (code) => !countries.byCountry.has(code),
          ),
      ) ?? null;
  const newest =
    [...watched].sort(
      (a, b) => dates.get(b.id)! - dates.get(a.id)! || a.id - b.id,
    )[0] ?? null;
  const nextTitle =
    USER_TITLE_DEFS.find(
      (def) => def.metric === 'watches' && def.target > seen.size,
    ) ?? null;
  return {
    watched,
    monthly,
    classified,
    genres: rankedGenres,
    countries,
    discovery,
    newest,
    nextTitle,
    streak,
    best,
    watchedToday: daySet.has(today),
    week: Array.from({ length: 7 }, (_, i) => ({
      day: today - 6 + i,
      active: daySet.has(today - 6 + i),
    })),
    month: date.toLocaleDateString('ru-RU', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
  };
}
