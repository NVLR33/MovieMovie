export type LibraryOptions = {
  query: string;
  category: string;
  watch: 'all' | 'unwatched' | 'watched';
  rating: 'all' | 'rated' | 'unrated';
  sort: 'collection' | 'rating' | 'mine' | 'year' | 'title';
};
export const emptyLibraryOptions: LibraryOptions = {
  query: '',
  category: 'Все',
  watch: 'all',
  rating: 'all',
  sort: 'collection',
};
type Material = {
  id: number;
  title: string;
  originalTitle?: string | null;
  genre: string;
  category: string;
  year: number;
  rating: number;
  ratingCount: number;
};
/** Only the supplied owned collection is considered. No catalog fallback or state writes. */
export function selectPersonalLibrary<T extends Material>(
  films: readonly T[],
  options: LibraryOptions,
  watched: ReadonlySet<number>,
  ratings: ReadonlyMap<number, number>,
): T[] {
  const query = options.query.trim().toLocaleLowerCase();
  const unique = new Map<number, T>();
  for (const film of films) if (!unique.has(film.id)) unique.set(film.id, film);
  const result = [...unique.values()].filter(
    (film) =>
      (!query ||
        [film.title, film.originalTitle, film.genre]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase()
          .includes(query)) &&
      (options.category === 'Все' || options.category === film.category) &&
      (options.watch === 'all' ||
        watched.has(film.id) === (options.watch === 'watched')) &&
      (options.rating === 'all' ||
        Number(ratings.get(film.id)) > 0 === (options.rating === 'rated')),
  );
  if (options.sort !== 'collection')
    result.sort(
      (a, b) =>
        (options.sort === 'rating'
          ? (b.ratingCount ? b.rating : 0) - (a.ratingCount ? a.rating : 0)
          : options.sort === 'mine'
            ? (ratings.get(b.id) || 0) - (ratings.get(a.id) || 0)
            : options.sort === 'year'
              ? b.year - a.year
              : a.title.localeCompare(b.title, 'ru')) || a.id - b.id,
    );
  return result;
}
