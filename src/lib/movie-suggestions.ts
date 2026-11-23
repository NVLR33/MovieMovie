import type { MaterialInput } from './material-input';
export type MovieSuggestion = {
  id: number; userId: number; title: string; year: number; genre: string; category: string;
  comment: string | null; material: MaterialInput | null;
  status: 'pending' | 'approved' | 'rejected'; createdAt: string; reviewedAt: string | null;
  reviewReason: string | null; movieId: number | null;
  author: { id: number; username: string; avatar: string | null; role: string } | null;
};
export function filterSuggestions<T extends MovieSuggestion>(items: readonly T[], options: { status: string; category: string; search: string; sort: string }) {
  const query = options.search.trim().toLowerCase();
  return items.filter(s => (options.status === 'all' || s.status === options.status) && (options.category === 'Все' || s.category === options.category) && (!query || [s.title, s.material?.originalTitle, s.author?.username, String(s.year)].some(value => value?.toLowerCase().includes(query))))
    .sort((a, b) => options.sort === 'oldest' ? a.id - b.id : b.id - a.id);
}
export function matchingSuggestionMovie<T extends { id: number; title: string; year: number; category: string }>(suggestion: MovieSuggestion, films: readonly T[]) {
  return films.find(film => film.title.trim().toLowerCase() === suggestion.title.trim().toLowerCase() && film.year === suggestion.year && film.category === suggestion.category);
}
