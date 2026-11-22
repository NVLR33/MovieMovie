export type DailyGameQuestion = {
  id: string;
  date: string;
  movieId: number;
  title: string;
  options: string[];
  correct: string;
};

type GameFilm = { id: number; title: string; year: number };

/** A deterministic sample of the existing release-year game. UTC day, no XP rewards. */
export function createDailyGame(films: readonly GameFilm[], now = new Date()): DailyGameQuestion | null {
  if (!Number.isFinite(now.getTime())) return null;
  const currentYear = now.getUTCFullYear();
  const candidates = [...films].filter(f => f.title.trim() && Number.isInteger(f.year) && f.year >= 1888 && f.year <= currentYear)
    .sort((a, b) => a.id - b.id);
  if (!candidates.length) return null;
  const day = Math.floor(now.getTime() / 86400000);
  const film = candidates[((day % candidates.length) + candidates.length) % candidates.length];
  const decoys = [-1, 1, -2, 2, -3, 3, -5, 5].map(offset => film.year + offset)
    .filter(year => year >= 1888 && year <= currentYear).slice(0, 3);
  if (decoys.length < 3) return null;
  const options = [film.year, ...decoys].map(String);
  // Seeded Fisher-Yates: stable options across refreshes and catalog query order.
  let seed = (day ^ film.id) >>> 0;
  for (let i = options.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }
  const date = now.toISOString().slice(0, 10);
  return { id: `${date}:year:${film.id}:${film.year}`, date, movieId: film.id, title: film.title, options, correct: String(film.year) };
}
