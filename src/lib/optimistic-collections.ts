export type CollectionUpdate = { movieId: number; kind: 'bookmark' | 'favorite' | 'watch' | 'rate'; enabled: boolean; value?: number; watchedAt: string };
type Collections = {
  bookmarks: { movieId: number }[]; favorites: { movieId: number }[]; favoriteIds: number[];
  watches: { id: number; movieId: number; watchedAt: string }[];
  ratings: { id: number; movieId: number; value: number }[];
};
/** Pure/idempotent: rebase onto SSE/server snapshots without toggling twice or inventing XP. */
export function applyCollectionUpdate<T extends Collections>(state: T, update: CollectionUpdate): T {
  const { movieId, kind, enabled } = update;
  if (kind === 'bookmark') return { ...state, bookmarks: [...state.bookmarks.filter(b => b.movieId !== movieId), ...(enabled ? [{ movieId }] : [])] };
  if (kind === 'favorite') return { ...state, favorites: [...state.favorites.filter(b => b.movieId !== movieId), ...(enabled ? [{ movieId }] : [])], favoriteIds: [...state.favoriteIds.filter(id => id !== movieId), ...(enabled ? [movieId] : [])] };
  if (kind === 'watch') return { ...state, watches: [...state.watches.filter(w => w.movieId !== movieId), ...(enabled ? [state.watches.find(w => w.movieId === movieId) || { id: -movieId, movieId, watchedAt: update.watchedAt }] : [])] };
  if (kind === 'rate' && Number.isFinite(update.value)) return { ...state, ratings: [...state.ratings.filter(r => r.movieId !== movieId), { id: state.ratings.find(r => r.movieId === movieId)?.id || -movieId, movieId, value: update.value! }] };
  return state;
}
