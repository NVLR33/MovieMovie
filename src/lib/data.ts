import { db } from '@/db';
import { 
  users, movies, watches, ratings, comments, 
  bookmarks, friendships, notifications, gameScores,
  collabLists, challenges, movieClub 
} from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export async function ensureSeed() {
  // Автозаполнение отключено для продакшена
  return;
}

// [DATA:DURATION] Расчет полного времени для сериалов / аниме
export function getTitleMinutes(film: { duration: number; episodes: number | null; category: string }) {
  const episodic = ['Сериал', 'Мультсериал', 'Аниме-сериал'].includes(film.category);
  return episodic ? film.duration * (film.episodes || 1) : film.duration;
}

export async function getOverview() {
  try {
    const rawMovies = await db.select().from(movies).orderBy(desc(movies.createdAt));
    const allUsers = await db.select().from(users).orderBy(desc(users.xp));
    const allRatings = await db.select().from(ratings);
    const allComments = await db.select().from(comments);
    const lists = await db.select().from(collabLists);
    const chs = await db.select().from(challenges);
    const club = await db.select().from(movieClub).where(eq(movieClub.active, true)).limit(1);

    // Подсчет средних оценок
    const scoreMap = new Map<number, { average: number; count: number }>();
    for (const r of allRatings) {
      if (!scoreMap.has(r.movieId)) scoreMap.set(r.movieId, { average: 0, count: 0 });
      const s = scoreMap.get(r.movieId)!;
      s.count++;
    }

    scoreMap.forEach((s, movieId) => {
      const movieRatings = allRatings.filter(r => r.movieId === movieId);
      const sum = movieRatings.reduce((a, b) => a + b.value, 0);
      s.average = Math.round((sum / s.count) * 10) / 10;
    });

    // Маппинг под формат фронтенда
    const mappedFilms = rawMovies.map(m => {
      const s = scoreMap.get(m.id);
      return {
        id: m.id,
        title: m.title,
        original_title: m.originalTitle || '',
        year: m.year,
        genres: m.genre ? m.genre.split(',').map(g => g.trim()) : ['Кино'],
        rating: s?.average || 9,
        votes: m.views || 0,
        duration: typeof m.duration === 'number' ? `${m.duration} мин` : `${m.duration}`,
        description: m.description,
        poster: m.poster,
        banner: m.backdrop || m.poster,
        type: m.category || 'movie',
        director: m.director || '',
        cast: [],
        trailer: m.watchUrl || ''
      };
    });

    let cineDayMovie = null;
    if (club.length > 0) {
      cineDayMovie = mappedFilms.find(m => m.id === club[0].movieId) || null;
    }
    if (!cineDayMovie && mappedFilms.length > 0) {
      cineDayMovie = mappedFilms[0];
    }

    return {
      movies: mappedFilms,
      ratings: allRatings,
      comments: allComments.map(c => ({
        id: c.id,
        movie_id: c.movieId,
        user_id: c.userId,
        text: c.body,
        created_at: c.createdAt
      })),
      leaderboard: allUsers,
      friends_activity: [],
      cineDay: cineDayMovie,
      season: { title: 'Сезон 2024' },
      onThisDay: mappedFilms.slice(0, 2),
      monthlySummary: { totalWatched: mappedFilms.length, topGenre: 'Фантастика' },
      collabLists: lists,
      challenges: chs.map(c => ({
        id: c.id,
        title: c.title,
        description: c.description,
        target: c.target,
        reward_xp: c.xpReward
      }))
    };
  } catch (err) {
    console.error('getOverview Error:', err);
    return {
      movies: [],
      ratings: [],
      comments: [],
      leaderboard: [],
      friends_activity: [],
      cineDay: null,
      season: {},
      onThisDay: [],
      monthlySummary: {},
      collabLists: [],
      challenges: []
    };
  }
}

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
