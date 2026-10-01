import { db } from '@/db';
import { users, movies, watches, ratings, comments, bookmarks, friendships, notifications, gameScores } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export async function ensureSeed() {
  // Автозаполнение (seed) отключено для продакшена, чтобы можно было вести свою базу с нуля.
  return;
}

export async function getOverview() {
  const films = await db.select().from(movies).orderBy(desc(movies.createdAt));
  const allRatings = await db.select().from(ratings);
  
  const scores = films.map(m => {
    const movieRatings = allRatings.filter(r => r.movieId === m.id);
    const count = movieRatings.length;
    const average = count > 0 ? movieRatings.reduce((a, b) => a + b.value, 0) / count : 0;
    
    const dist: Record<string, number> = {};
    movieRatings.forEach(r => {
      dist[r.value.toString()] = (dist[r.value.toString()] || 0) + 1;
    });
    
    return { movieId: m.id, average: Math.round(average * 10) / 10, count, dist };
  });

  return films.map(m => {
    const s = scores.find(x => x.movieId === m.id);
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
