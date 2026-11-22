import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { seriesSeasons, seriesEpisodes, seasonRatings, episodeRatings, seriesCompletions, notifications } from '@/db/schema';
import { seriesProgress, type SeriesSeason } from './series';

type Reader = Pick<typeof db, 'select'>;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function loadSeries(reader: Reader, movieId: number, userId: number | null): Promise<SeriesSeason[]> {
  const seasons = await reader.select().from(seriesSeasons).where(eq(seriesSeasons.movieId, movieId)).orderBy(seriesSeasons.number);
  if (!seasons.length) return [];
  const seasonIds = seasons.map(s => s.id);
  const episodes = await reader.select().from(seriesEpisodes).where(inArray(seriesEpisodes.seasonId, seasonIds)).orderBy(seriesEpisodes.number);
  const ownSeasons = userId === null ? [] : await reader.select({ seasonId: seasonRatings.seasonId, value: seasonRatings.value }).from(seasonRatings)
    .where(and(eq(seasonRatings.userId, userId), inArray(seasonRatings.seasonId, seasonIds)));
  const ownEpisodes = userId === null || !episodes.length ? [] : await reader.select({ episodeId: episodeRatings.episodeId, value: episodeRatings.value }).from(episodeRatings)
    .where(and(eq(episodeRatings.userId, userId), inArray(episodeRatings.episodeId, episodes.map(e => e.id))));
  const seasonValues = new Map(ownSeasons.map(r => [r.seasonId, r.value]));
  const episodeValues = new Map(ownEpisodes.map(r => [r.episodeId, r.value]));
  return seasons.map(season => ({ id: season.id, number: season.number, title: season.title, rating: seasonValues.get(season.id) ?? null,
    episodes: episodes.filter(e => e.seasonId === season.id).map(e => ({ id: e.id, number: e.number, title: e.title, rating: episodeValues.get(e.id) ?? null })),
  }));
}

/** Caller holds user -> movie locks. A completion is permanent, unique, and grants no XP. */
export async function syncSeriesCompletion(tx: Transaction, userId: number, movieId: number, catalogComplete: boolean) {
  const seasons = await loadSeries(tx, movieId, userId);
  if (!seriesProgress(seasons, catalogComplete).complete) return false;
  const inserted = await tx.insert(seriesCompletions).values({ userId, movieId })
    .onConflictDoNothing({ target: [seriesCompletions.userId, seriesCompletions.movieId] }).returning({ id: seriesCompletions.id });
  if (!inserted.length) return false;
  await tx.insert(notifications).values({ userId, message: '📚 Все сезоны и эпизоды оценены! Сериал засчитан в достижение «Серийный маньяк».', link: '/achievements' });
  return true;
}
