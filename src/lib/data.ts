import { cache } from 'react';
import { summarizeRatings } from '@/lib/rating-summary';
import { db } from '@/db';
import { users, movies, watches, ratings, comments, bookmarks, friendships, notifications, gameScores, favorites } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export async function ensureSeed() {
  // Автозаполнение (seed) отключено для продакшена.
  return;
}

// [DATA:DURATION] Count full title time for series/anime titles.
export function getTitleMinutes(film:{duration:number;episodes:number|null;category:string}){
  const episodic = ['Сериал','Мультсериал','Аниме-сериал'].includes(film.category);
  return episodic ? film.duration * (film.episodes || 1) : film.duration;
}

// React cache deduplicates metadata/page reads within a render, without stale cross-request data.
export const getOverview = cache(async () => {
  const [films, favoriteGroups, ratingGroups] = await Promise.all([
    db.select().from(movies).orderBy(desc(movies.createdAt)),
    db.select({ movieId: favorites.movieId, count: sql<number>`count(*)::int` })
      .from(favorites).groupBy(favorites.movieId),
    db.select({ movieId: ratings.movieId, value: ratings.value, count: sql<number>`count(*)::int` })
      .from(ratings).groupBy(ratings.movieId, ratings.value),
  ]);
  const favoriteMap = new Map(favoriteGroups.map(row => [row.movieId, row.count]));
  const scoreMap = summarizeRatings(ratingGroups);

  return films.map(m => {
    const s = scoreMap.get(m.id);
    return { ...m, favoriteCount: favoriteMap.get(m.id) || 0, rating: s?.average || 0, ratingCount: s?.count || 0, ratingDist: s?.dist || {} };
  });
});

export type Film = {
  id: number;
  title: string;
  originalTitle: string | null;
  description: string;
  category: string;
  genre: string;
  studio: string | null;
  mood: string | null;
  year: number;
  ageRating?: string | null;
  duration: number;
  episodes: number | null;
  poster: string;
  backdrop: string | null;
  watchUrl: string | null;
  trailerUrl?: string | null;
  director: string | null;
  cast?: string | null;
  franchise?: string;
  festivalRecognized?: boolean;
  country: string | null;
  featured: boolean | null;
  views: number | null;
  createdAt: Date;
  rating: number;
  ratingCount: number;
  favoriteCount?: number;
  ratingDist: Record<string, number>;
};

export { db, users, movies, watches, ratings, comments, bookmarks, friendships, notifications, gameScores, eq, desc, sql };
