import type { AchievementProgress } from './achievements';

export type AchievementFilm = { id: number; duration: number; category: string; genre: string };
export type AchievementWatch = { movieId: number; watchedAt: Date | string };
export type AchievementActivity = {
  xp: number;
  watches: readonly AchievementWatch[];
  ratings: readonly { value: number }[];
  comments: readonly { likes: number | null }[];
  scores: readonly { game: string; score: number }[];
  friendCount: number;
  bookmarkCount: number;
  recommendationCount: number;
  messageCount: number;
  completedChallenges: number;
};

/** One pass over a user's activity. All calendar-based rules use UTC on the server. */
export function calculateAchievementProgress(
  activity: AchievementActivity,
  films: ReadonlyMap<number, AchievementFilm>,
): AchievementProgress {
  const byDay = new Map<string, number>();
  const categories = new Set<string>();
  const uniqueFilms = new Set<number>();
  let night = 0, weekend = 0, minutes = 0;
  let anime = 0, cartoon = 0, series = 0, thriller = 0, scifi = 0, drama = 0, action = 0;
  for (const watch of activity.watches) {
    uniqueFilms.add(watch.movieId);
    const date = new Date(watch.watchedAt);
    if (Number.isFinite(date.getTime())) {
      const day = date.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) || 0) + 1);
      if (date.getUTCHours() >= 20) night++;
      if ([0, 6].includes(date.getUTCDay())) weekend++;
    }
    const film = films.get(watch.movieId);
    if (!film) continue;
    categories.add(film.category);
    minutes += film.duration;
    const genre = film.genre.toLowerCase();
    if (film.category.includes('Аниме')) anime++;
    if (film.category.includes('Мульт')) cartoon++;
    if (film.category === 'Сериал') series++;
    if (genre.includes('триллер') || genre.includes('ужас')) thriller++;
    if (genre.includes('фантастика')) scifi++;
    if (genre.includes('драма')) drama++;
    if (genre.includes('боевик') || genre.includes('экшен')) action++;
  }
  const games = activity.scores.filter(score => score.game !== 'chat');
  return {
    watch: activity.watches.length,
    hundred: activity.watches.length,
    binge: byDay.size,
    night,
    hours: Math.floor(minutes / 60),
    weekend,
    explorer: uniqueFilms.size,
    speed: [...byDay.values()].filter(count => count >= 3).length,
    anime, cartoon, series, genre_all: categories.size, thriller, scifi, drama, action,
    ratings: activity.ratings.length,
    perfectionist: activity.ratings.filter(rating => rating.value === 10).length,
    harsh: activity.ratings.filter(rating => rating.value <= 4).length,
    voice: activity.comments.length,
    popular_comment: activity.comments.reduce((sum, comment) => sum + (comment.likes || 0), 0),
    social: activity.friendCount,
    collector: activity.bookmarkCount,
    ambassador: activity.recommendationCount,
    chatty: activity.messageCount,
    player: games.length,
    champion: games.filter(score => score.score >= 5).length,
    allgames: new Set(games.map(score => score.game)).size,
    master: activity.xp,
    level10: Math.floor(activity.xp / 500) + 1,
    challenges_done: activity.completedChallenges,
  };
}
