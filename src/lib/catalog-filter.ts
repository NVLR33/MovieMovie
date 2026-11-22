import { matchesCatalogMood, parseCatalogMood, type CatalogMood } from './catalog-moods';
import { MATERIAL_CATEGORIES } from './material-ranking';
type CatalogMaterial = { id: number; title: string; originalTitle?: string | null; description: string; category: string; genre: string; studio?: string | null; director?: string | null; cast?: string | null; mood?: string | null; year: number; rating: number; views: number | null };
export const catalogTokens = (value?: string | null) => (value || '').split(',').map(token => token.trim()).filter(Boolean);
export type CatalogOptions = { query: string; category: string; genre: string; studio: string; year: string; sort: string; minRating: string; watchFilter: string; mood: CatalogMood };
export function parseCatalogOptions(params: { get(key: string): string | null }, search = ''): CatalogOptions {
  const year = params.get('year') || '';
  const sort = params.get('sort') || '';
  const minRating = params.get('minRating') || '';
  const watchFilter = params.get('watch') || '';
  return {
    query: (params.get('search') || search).trim(),
    category: MATERIAL_CATEGORIES.find(category => category === params.get('category')) || 'Все',
    genre: params.get('genre')?.trim() || 'Все жанры',
    studio: params.get('studio')?.trim() || 'Все студии',
    year: year === 'before1960' || (/^\d{4}$/.test(year) && Number(year) >= 1888 && Number(year) <= 2100) ? year : 'Любой год',
    sort: ['popular', 'rating', 'new', 'old'].includes(sort) ? sort : 'popular',
    minRating: ['0', '7', '8', '9'].includes(minRating) ? minRating : '0',
    watchFilter: ['watched', 'unwatched'].includes(watchFilter) ? watchFilter : 'all',
    mood: parseCatalogMood(params.get('mood')),
  };
}
export function filterCatalog<T extends CatalogMaterial>(films: readonly T[], options: CatalogOptions, watchedIds: ReadonlySet<number>) {
  const { category, genre, studio, year, sort, minRating, watchFilter, mood } = options;
  const query = options.query.trim().toLocaleLowerCase();
  return films.filter(film => matchesCatalogMood(film, mood) &&
    (!query || [film.title, film.originalTitle, film.genre, film.director, film.description, film.category, film.studio, film.cast].filter(Boolean).join(' ').toLocaleLowerCase().includes(query)) &&
    (category === 'Все' || film.category === category) &&
    (genre === 'Все жанры' || catalogTokens(film.genre).some(token => token.toLocaleLowerCase() === genre.toLocaleLowerCase())) &&
    (studio === 'Все студии' || catalogTokens(film.studio).some(token => token.toLocaleLowerCase() === studio.toLocaleLowerCase())) &&
    (year === 'Любой год' || (year === 'before1960' ? film.year >= 1888 && film.year < 1960 : String(film.year) === year)) &&
    film.rating >= Number(minRating) &&
    (watchFilter === 'all' || (watchFilter === 'watched' ? watchedIds.has(film.id) : !watchedIds.has(film.id)))
  ).sort((a, b) => (sort === 'rating' ? b.rating - a.rating : sort === 'new' ? b.year - a.year : sort === 'old' ? a.year - b.year : (b.views || 0) - (a.views || 0)) || a.id - b.id);
}
