/** A zero without votes is missing data, not a bad audience rating. */
export function formatFilmRating(film: { rating: number; ratingCount: number }): string {
  return film.ratingCount > 0 && Number.isFinite(film.rating) && film.rating > 0
    ? film.rating.toFixed(1)
    : '—';
}
