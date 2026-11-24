import { splitCinemaNames } from './cinema-card';
export type CollectionKind = 'studio' | 'actor' | 'genre';
export type CollectionFilm = {
  id: number;
  title: string;
  studio?: string | null;
  cast?: string | null;
  genre: string;
  backdrop?: string | null;
  rating: number;
  ratingCount: number;
  views: number | null;
  year: number;
};
export type CinemaCollection<T extends CollectionFilm = CollectionFilm> = {
  key: string;
  name: string;
  kind: CollectionKind;
  films: T[];
  backdrop: string | null;
};
const normalize = (value: string) =>
  value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е');
const unknown = new Set([
  '-',
  '—',
  'unknown',
  'n/a',
  'неизвестно',
  'не указано',
]);
export function buildCinemaCollections<T extends CollectionFilm>(
  films: readonly T[],
): CinemaCollection<T>[] {
  const groups = new Map<string, CinemaCollection<T>>(),
    seen = new Set<number>();
  for (const film of films) {
    if (seen.has(film.id)) continue;
    seen.add(film.id);
    for (const kind of ['studio', 'actor', 'genre'] as const) {
      const raw =
        kind === 'studio'
          ? film.studio
          : kind === 'actor'
            ? film.cast
            : film.genre;
      const names = new Set<string>();
      for (const name of splitCinemaNames(raw || '')) {
        const canonical = normalize(name);
        if (!canonical || unknown.has(canonical) || names.has(canonical))
          continue;
        names.add(canonical);
        const key = `${kind}:${canonical}`,
          group = groups.get(key) || {
            key,
            name,
            kind,
            films: [],
            backdrop: null,
          };
        group.films.push(film);
        groups.set(key, group);
      }
    }
  }
  for (const group of groups.values()) {
    group.films.sort(
      (a, b) =>
        Number(b.ratingCount > 0) - Number(a.ratingCount > 0) ||
        (b.ratingCount > 0 && a.ratingCount > 0 ? b.rating - a.rating : 0) ||
        (b.views || 0) - (a.views || 0) ||
        b.year - a.year ||
        a.id - b.id,
    );
    group.backdrop =
      group.films.find((film) => film.backdrop?.trim())?.backdrop || null;
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.films.length - a.films.length ||
      a.name.localeCompare(b.name, 'ru') ||
      a.key.localeCompare(b.key),
  );
}
export function filterCinemaCollections<T extends CollectionFilm>(
  groups: readonly CinemaCollection<T>[],
  kind: string,
  query: string,
) {
  const term = normalize(query);
  return groups.filter(
    (group) =>
      (kind === 'all' || group.kind === kind) &&
      (!term || normalize(group.name).includes(term)),
  );
}
export function collectionShowcaseUrl(view: string = 'all', key?: string) {
  const params = new URLSearchParams();
  if (['studio', 'actor', 'genre', 'personal'].includes(view))
    params.set('view', view);
  if (key) params.set('collection', key);
  return '/collab' + (params.size ? '?' + params : '');
}
