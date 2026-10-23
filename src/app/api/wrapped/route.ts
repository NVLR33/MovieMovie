import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte, lt } from 'drizzle-orm';

import { db } from '@/db';
import { getUser } from '@/lib/auth';

import {
  watches,
  movies,
  ratings,
  challenges,
  challengeProgress,
} from '@/db/schema';

type WatchedMovie = {
  movieId: number;
  watchedAt: Date;
  title: string;
  poster: string;
  genre: string;
  category: string;
  duration: number;
  episodes: number | null;
};

function getMinutes(movie: WatchedMovie) {
  const episodic = [
    'Сериал',
    'Мультсериал',
    'Аниме-сериал',
  ].includes(movie.category);

  return episodic
    ? movie.duration * (movie.episodes || 1)
    : movie.duration;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Необходима авторизация' },
        { status: 401 }
      );
    }

    const currentYear = new Date().getUTCFullYear();

    const requestedYear = Number(
      request.nextUrl.searchParams.get('year') ||
        currentYear
    );

    if (
      !Number.isInteger(requestedYear) ||
      requestedYear < 2000 ||
      requestedYear > currentYear
    ) {
      return NextResponse.json(
        { error: 'Некорректный год' },
        { status: 400 }
      );
    }

    const start = new Date(
      Date.UTC(requestedYear, 0, 1)
    );

    const end = new Date(
      Date.UTC(requestedYear + 1, 0, 1)
    );

    // Просмотры только выбранного года
    const watched = await db
      .select({
        movieId: watches.movieId,
        watchedAt: watches.watchedAt,

        title: movies.title,
        poster: movies.poster,
        genre: movies.genre,
        category: movies.category,
        duration: movies.duration,
        episodes: movies.episodes,
      })
      .from(watches)
      .innerJoin(
        movies,
        eq(watches.movieId, movies.id)
      )
      .where(
        and(
          eq(watches.userId, user.id),
          gte(watches.watchedAt, start),
          lt(watches.watchedAt, end)
        )
      );

    // Уникальные материалы
    const uniqueMovieIds = new Set(
      watched.map(w => w.movieId)
    );

    // Общее время просмотра
    const totalMinutes = watched.reduce(
      (sum, movie) => sum + getMinutes(movie),
      0
    );

    // Любимые жанры
    const genreMap = new Map<string, number>();

    for (const movie of watched) {
      const genres = new Set(
        movie.genre
          .split(',')
          .map(g => g.trim())
          .filter(Boolean)
      );

      for (const genre of genres) {
        genreMap.set(
          genre,
          (genreMap.get(genre) || 0) + 1
        );
      }
    }

    const topGenres = [...genreMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
      }));

    // Активность по месяцам
    const months = Array.from(
      { length: 12 },
      () => 0
    );

    for (const movie of watched) {
      const month = new Date(
        movie.watchedAt
      ).getUTCMonth();

      months[month]++;
    }

    const bestMonthIndex = months.indexOf(
      Math.max(...months)
    );

    const monthNames = [
      'Январь',
      'Февраль',
      'Март',
      'Апрель',
      'Май',
      'Июнь',
      'Июль',
      'Август',
      'Сентябрь',
      'Октябрь',
      'Ноябрь',
      'Декабрь',
    ];

    // Оценки просмотренных материалов
    const userRatings = await db
      .select({
        movieId: ratings.movieId,
        value: ratings.value,
      })
      .from(ratings)
      .where(eq(ratings.userId, user.id));

    const yearRatings = userRatings.filter(
      rating => uniqueMovieIds.has(rating.movieId)
    );

    const averageRating = yearRatings.length
      ? Number(
          (
            yearRatings.reduce(
              (sum, rating) => sum + rating.value,
              0
            ) / yearRatings.length
          ).toFixed(1)
        )
      : null;

    const bestRating = [...yearRatings].sort(
      (a, b) => b.value - a.value
    )[0];

    const bestMovie = bestRating
      ? watched.find(
          movie => movie.movieId === bestRating.movieId
        )
      : null;

    // Выполненные челленджи выбранного года
    const completedChallenges = await db
      .select({
        id: challenges.id,
        title: challenges.title,
        icon: challenges.icon,
        xpReward: challenges.xpReward,
      })
      .from(challengeProgress)
      .innerJoin(
        challenges,
        eq(challengeProgress.challengeId, challenges.id)
      )
      .where(
        and(
          eq(challengeProgress.userId, user.id),
          eq(challengeProgress.year, requestedYear),
          eq(challengeProgress.rewardClaimed, true)
        )
      );

    const challengeXP = completedChallenges.reduce(
      (sum, challenge) => sum + challenge.xpReward,
      0
    );

    // Постеры для оформления Wrapped
    const posters = [
      ...new Map(
        watched.map(movie => [
          movie.movieId,
          {
            id: movie.movieId,
            title: movie.title,
            poster: movie.poster,
          },
        ])
      ).values(),
    ].slice(0, 12);

    return NextResponse.json({
      year: requestedYear,
      username: user.username,

      watches: watched.length,
      uniqueMovies: uniqueMovieIds.size,

      minutes: totalMinutes,
      hours: Math.floor(totalMinutes / 60),
      days: Number(
        (totalMinutes / 1440).toFixed(1)
      ),

      topGenres,

      months,

      bestMonth: watched.length
        ? {
            name: monthNames[bestMonthIndex],
            count: months[bestMonthIndex],
          }
        : null,

      averageRating,
      ratingsCount: yearRatings.length,

      bestMovie: bestMovie
        ? {
            id: bestMovie.movieId,
            title: bestMovie.title,
            poster: bestMovie.poster,
            rating: bestRating.value,
          }
        : null,

      challengesCompleted: completedChallenges.length,
      challengeXP,

      posters,

      hasData: watched.length > 0,
    });
  } catch (error) {
    console.error('Wrapped API error:', error);

    return NextResponse.json(
      { error: 'Не удалось загрузить итоги года' },
      { status: 500 }
    );
  }
}
