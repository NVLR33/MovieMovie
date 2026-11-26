export const SERIES_CATEGORIES = ['Сериал', 'Мультсериал', 'Аниме-сериал'] as const;
export const SERIAL_MIN_EPISODES = 10;
export function isSeries(category: string) { return (SERIES_CATEGORIES as readonly string[]).includes(category); }
export function validSeriesRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.5 && value <= 10 && Number.isInteger(value * 2);
}
export type SeriesEpisode = { id: number; number: number; title: string; rating: number | null; playbackUrl?: string };
export type SeriesSeason = { id: number; number: number; title: string; rating: number | null; episodes: SeriesEpisode[] };
export type SeriesSnapshot = { seasons: SeriesSeason[]; catalogComplete: boolean; completed: boolean; canEdit: boolean; authenticated: boolean };

export function seriesProgress(seasons: readonly SeriesSeason[], catalogComplete: boolean) {
  const episodes = seasons.flatMap(s => s.episodes);
  const total = seasons.length + episodes.length;
  const rated = seasons.filter(s => validSeriesRating(s.rating)).length + episodes.filter(e => validSeriesRating(e.rating)).length;
  const ready = catalogComplete && seasons.length > 0 && seasons.every(s => s.episodes.length > 0) && episodes.length >= SERIAL_MIN_EPISODES;
  return { total, rated, episodeCount: episodes.length, ready, complete: ready && rated === total };
}
