import type { SeriesSeason } from './series';

/** Season numbers are shareable; database IDs make remembered choices survive renumbering. */
export function seasonNumber(value: string | null): number | null {
  if (!value || !/^[1-9]\d{0,2}$/.test(value)) return null;
  const number = Number(value);
  return number <= 100 ? number : null;
}
export function resolveSeason(
  seasons: readonly SeriesSeason[],
  requested: string | null,
  rememberedId: string | null,
) {
  return (
    seasons.find((season) => season.number === seasonNumber(requested)) ??
    seasons.find((season) => String(season.id) === rememberedId) ??
    seasons[0] ??
    null
  );
}
export function seasonLink(href: string, number: number): string {
  const url = new URL(href);
  url.searchParams.set('season', String(number));
  url.hash = 'series-seasons';
  return url.href;
}
export function seasonStorageKey(
  movieId: number,
  userId: number | null,
): string {
  return `mg_series_season:${userId ?? 'guest'}:${movieId}`;
}
