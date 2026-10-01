import { db } from '@/db';
import { users, movies, watches, ratings, comments, bookmarks, friendships, notifications, gameScores } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export async function ensureSeed() {
  // Автозаполнение (seed) отключено для продакшена.
  return;
}

export async function getOverview() {
  const films = await db.select().from(movies).orderBy(desc(movies.createdAt));
  const allRatings = await db.select().from(ratings);
  
  const scoreMap = new Map<number, { average: number; count: number; dist: Record<string, number> }>();
  
  for (const r of allRatings) {
    if (!scoreMap.has(r.movieId)) {
      scoreMap.set(r.movieId, { average: 0, count: 0, dist: {} });
    }
    const s = scoreMap.get(r.movieId)!;
    s.count++;
    const valKey = r.value.toString();
    s.dist[valKey] = (s.dist[valKey] || 0) + 1;
  }

  // Calculate averages
  scoreMap.forEach((s, movieId) => {
    const movieRatings = allRatings.filter(r => r.movieId === movieId);
    const sum = movieRatings.reduce((a, b) => a + b.value, 0);
    s.average = Math.round((sum / s.count) * 10) / 10;
  });

  return films.map(m => {
    const s = scoreMap.get(m.id);
    return {
      ...m,
      rating: s?.average || 0,
      ratingCount: s?.count || 0,
      ratingDist: s?.dist || {}
    };
  });
}

export type Film = {
  id: number;
  title: string;
  originalTitle: string | null;
  description: string;
  category: string;
  genre: string;
  mood: string | null;
  year: number;
  duration: number;
  episodes: number | null;
  poster: string;
  backdrop: string | null;
  watchUrl: string | null;
  director: string | null;
  country: string | null;
  featured: boolean | null;
  views: number | null;
  createdAt: Date;
  rating: number;
  ratingCount: number;
  ratingDist: Record<string, number>;
};

export { db, users, movies, watches, ratings, comments, bookmarks, friendships, notifications, gameScores, eq, desc, sql };
