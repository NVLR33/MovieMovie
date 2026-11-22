import { ACHIEVEMENT_TIERS } from '@/lib/achievements';
import type { HiddenAchievementId, UnlockedHiddenAchievement } from './hidden-achievement-types';
import { achievementDefs, type AchievementId, type AchievementProgress } from './achievements';
import type { OwnershipStats } from './ownership';

export type CinemaCardFilm = { id: number; genre: string; cast?: string | null; duration: number; episodes: number | null; category: string };
export type CinemaCrown = { id: AchievementId | HiddenAchievementId; hidden?: boolean; name: string; icon: string; tier: number; stats: OwnershipStats };
export type CinemaCardData = {
  userId: number;
  username: string;
  totalMinutes: number;
  watches: number;
  uniqueTitles: number;
  topGenres: { name: string; count: number; percentage: number }[];
  topActor: { name: string; count: number } | null;
  castCoverage: { known: number; total: number };
  crown: CinemaCrown | null;
};

/** Comma, semicolon and newline separated names; one occurrence per title, case insensitive. */
export function splitCinemaNames(value: string) {
  const names = new Map<string, string>();
  for (const part of value.split(/[,;\n\r]+/)) {
    const name = part.trim().replace(/\s+/g, ' ');
    if (name) {
      const key = name.toLocaleLowerCase('ru-RU');
      if (!names.has(key)) names.set(key, name);
    }
  }
  return [...names.values()];
}

export function selectCinemaCrown(progress: Partial<AchievementProgress>, ownership: Partial<Record<AchievementId, OwnershipStats[]>>, hiddenAwards: readonly UnlockedHiddenAchievement[] = []): CinemaCrown | null {
  const candidates: CinemaCrown[] = [];
  for (const def of achievementDefs) {
    def.targets.forEach((target, index) => {
      const stats = ownership[def.id]?.[index];
      // Never suggest an unearned badge or one without reliable community statistics.
      if ((progress[def.id] ?? 0) >= target && stats?.percentage !== null && stats?.percentage !== undefined && stats.earnedUsers > 0 && stats.rarity) {
        candidates.push({ id: def.id, name: def.name, icon: def.icon, tier: index + 1, stats });
      }
    });
  }
  for (const award of hiddenAwards) {
    if (award.community.percentage !== null && award.community.earnedUsers > 0 && award.community.rarity) {
      candidates.push({ id: award.id, name: award.name, icon: award.icon, tier: 1, hidden: true, stats: award.community });
    }
  }
  return candidates.sort((a, b) => a.stats.percentage! - b.stats.percentage! || b.tier - a.tier || a.id.localeCompare(b.id))[0] || null;
}

/** Counts watch sessions, including rewatches; episodic titles count their full duration, like the profile. */
export function buildCinemaCard(input: {
  user: { id: number; username: string };
  films: readonly CinemaCardFilm[];
  watches: readonly { movieId: number }[];
  hiddenAchievements?: readonly UnlockedHiddenAchievement[];
  progress: Partial<AchievementProgress>;
  ownership: Partial<Record<AchievementId, OwnershipStats[]>>;
}): CinemaCardData {
  const films = new Map(input.films.map(film => [film.id, film]));
  const genres = new Map<string, { name: string; count: number }>();
  const actors = new Map<string, { name: string; count: number }>();
  const unique = new Set<number>();
  let totalMinutes = 0, watches = 0, castKnown = 0;
  for (const watch of input.watches) {
    const film = films.get(watch.movieId);
    if (!film) continue;
    watches++;
    unique.add(film.id);
    const duration = Number.isFinite(film.duration) ? Math.max(0, film.duration) : 0;
    const episodes = film.episodes && Number.isFinite(film.episodes) ? Math.max(1, film.episodes) : 1;
    totalMinutes += duration * (['Сериал', 'Мультсериал', 'Аниме-сериал'].includes(film.category) ? episodes : 1);
    for (const name of splitCinemaNames(film.genre)) {
      const key = name.toLocaleLowerCase('ru-RU');
      const item = genres.get(key) || { name, count: 0 };
      item.count++;
      genres.set(key, item);
    }
    const cast = splitCinemaNames(film.cast || '');
    if (cast.length) castKnown++;
    for (const name of cast) {
      const key = name.toLocaleLowerCase('ru-RU');
      const item = actors.get(key) || { name, count: 0 };
      item.count++;
      actors.set(key, item);
    }
  }
  const byCount = (a: { name: string; count: number }, b: { name: string; count: number }) => b.count - a.count || a.name.localeCompare(b.name, 'ru');
  return {
    userId: input.user.id,
    username: input.user.username,
    totalMinutes: Math.round(totalMinutes),
    watches,
    uniqueTitles: unique.size,
    topGenres: [...genres.values()].sort(byCount).slice(0, 3).map(genre => ({ ...genre, percentage: watches ? Math.round(genre.count / watches * 100) : 0 })),
    topActor: [...actors.values()].sort(byCount)[0] || null,
    castCoverage: { known: castKnown, total: watches },
    crown: selectCinemaCrown(input.progress, input.ownership, input.hiddenAchievements),
  };
}

export function cinemaCardShareText(card: CinemaCardData) {
  return [
    `Кино-визитка ${card.username} · moviemovie`,
    `В кино: ${Math.floor(card.totalMinutes / 60)} ч ${card.totalMinutes % 60} мин · ${card.uniqueTitles} историй`,
    card.topGenres.length ? `Мои жанры: ${card.topGenres.map(genre => genre.name).join(', ')}` : '',
    card.topActor ? `Мой актёр: ${card.topActor.name}` : '',
    card.crown ? `Коронная ачивка: ${card.crown.name} · ${card.crown.hidden ? 'скрытый трофей' : ACHIEVEMENT_TIERS[card.crown.tier - 1]}` : '',
  ].filter(Boolean).join('\n');
}
