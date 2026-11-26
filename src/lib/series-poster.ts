import { isSeries } from './series';
export type SeriesPosterFilm = {
  category: string;
  episodes?: number | null;
  seasonCount?: number | null;
  seriesCatalogComplete?: boolean | null;
};
function count(value: number | null | undefined) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}
export function seriesPosterLabel(film: SeriesPosterFilm | undefined) {
  if (!film || !isSeries(film.category)) return null;
  const seasons = count(film.seasonCount),
    episodes = count(film.episodes);
  return {
    short: [
      seasons ? `${seasons} сез.` : film.category,
      episodes ? `${episodes} сер.` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    description: [
      film.category,
      seasons
        ? `${film.seriesCatalogComplete ? 'Сезонов в каталоге' : 'Сезонов добавлено'}: ${seasons}`
        : null,
      episodes ? `Заявлено серий: ${episodes}` : null,
    ]
      .filter(Boolean)
      .join('. '),
  };
}
