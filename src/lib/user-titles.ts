export const USER_TITLE_DEFS = [
  { id: 'beginner', name: 'Начинающий зритель', icon: '🎟️', target: 0, metric: 'watches', category: 'Зрительский путь', tone: 'silver', description: 'Начало твоей киноистории.' },
  { id: 'seeker', name: 'Киноискатель', icon: '🔎', target: 5, metric: 'watches', category: 'Зрительский путь', tone: 'teal', description: 'Отметь 5 разных материалов просмотренными.' },
  { id: 'frame_master', name: 'Мастер кадров', icon: '🎞️', target: 15, metric: 'watches', category: 'Зрительский путь', tone: 'blue', description: 'Отметь 15 разных материалов просмотренными.' },
  { id: 'screen_legend', name: 'Легенда экрана', icon: '🌟', target: 30, metric: 'watches', category: 'Зрительский путь', tone: 'violet', description: 'Отметь 30 разных материалов просмотренными.' },
  { id: 'connoisseur', name: 'Кинознаток', icon: '🎬', target: 100, metric: 'watches', category: 'Зрительский путь', tone: 'violet', description: 'Отметь 100 разных материалов просмотренными.' },
  { id: 'archivist', name: 'Архивариус кино', icon: '📚', target: 250, metric: 'watches', category: 'Зрительский путь', tone: 'gold', description: 'Отметь 250 разных материалов просмотренными.' },
  { id: 'universe_keeper', name: 'Хранитель киновселенной', icon: '👑', target: 500, metric: 'watches', category: 'Зрительский путь', tone: 'gold', description: 'Отметь 500 разных материалов просмотренными.' },
  { id: 'marvel_advocate', name: 'Адвокат Marvel', icon: '🛡️', target: 3, metric: 'marvel', category: 'Особые заслуги', tone: 'red', description: 'Поставь 10/10 всем фильмам с франшизой Marvel в каталоге. В каталоге должно быть не меньше 3 таких фильмов.' },
  { id: 'arthouse_king', name: 'Король артхауса', icon: '🌿', target: 50, metric: 'festival', category: 'Особые заслуги', tone: 'teal', description: 'Посмотри 50 разных фильмов с редакционной отметкой «Фестивальное кино».' },
  { id: 'serial_spoiler', name: 'Серийный спойлерщик', icon: '🙈', target: 10, metric: 'spoilers', category: 'Особые заслуги', tone: 'amber', description: 'Напиши отзывы от 80 символов к 10 разным материалам, скрытые тегом «Спойлер». Ответы не учитываются.' },
] as const;
export type UserTitleId = typeof USER_TITLE_DEFS[number]['id'];
export type UserTitleDisplay = Pick<typeof USER_TITLE_DEFS[number], 'id' | 'name' | 'icon' | 'tone' | 'description'>;
export type UserTitleProgress = { watches: number; marvel: number; marvelTotal: number; festival: number; spoilers: number };
export type UserTitleOption = typeof USER_TITLE_DEFS[number] & { progress: number; required: number; unlocked: boolean; earned: boolean };
export type UserTitleCollection = { equipped: string | null; active: UserTitleDisplay | null; options: UserTitleOption[] };
export type TitleFilm = { id: number; category: string; franchise?: string; festivalRecognized?: boolean };

export function calculateUserTitleProgress(input: {
  films: readonly TitleFilm[];
  watches: readonly { movieId: number }[];
  ratings: readonly { movieId: number; value: number }[];
  comments: readonly { movieId: number; parentId: number | null; body: string; spoiler?: boolean }[];
}): UserTitleProgress {
  const films = new Map(input.films.map(film => [film.id, film]));
  const watches = new Set(input.watches.filter(watch => films.has(watch.movieId)).map(watch => watch.movieId));
  const marvelIds = input.films.filter(film => film.category === 'Фильм' && film.franchise?.trim().toLowerCase() === 'marvel').map(film => film.id);
  const tens = new Set(input.ratings.filter(rating => rating.value === 10).map(rating => rating.movieId));
  const festival = [...watches].filter(id => films.get(id)?.category === 'Фильм' && films.get(id)?.festivalRecognized).length;
  const spoilers = new Set(input.comments.filter(comment => comment.parentId === null && comment.spoiler && [...comment.body.trim()].length >= 80 && films.has(comment.movieId)).map(comment => comment.movieId)).size;
  return { watches: watches.size, marvel: marvelIds.filter(id => tens.has(id)).length, marvelTotal: marvelIds.length, festival, spoilers };
}

export function userTitleOptions(progress: UserTitleProgress, earned: readonly string[] = []): UserTitleOption[] {
  const permanent = new Set(earned);
  return USER_TITLE_DEFS.map(def => {
    const required = def.metric === 'marvel' ? Math.max(3, progress.marvelTotal) : def.target;
    const value = progress[def.metric];
    return { ...def, progress: value, required, unlocked: permanent.has(def.id) || value >= required, earned: permanent.has(def.id) };
  });
}

export function resolveUserTitle(options: readonly UserTitleOption[], equipped: string | null): UserTitleDisplay | null {
  if (equipped === 'none') return null;
  const chosen = options.find(option => option.id === equipped && option.unlocked);
  // Automatic mode remains the viewer's highest earned progression rank, not an arbitrary special title.
  const automatic = [...options].reverse().find(option => option.metric === 'watches' && option.unlocked);
  const active = chosen || automatic;
  if (!active) return null;
  const { id, name, icon, tone, description } = active;
  return { id, name, icon, tone, description };
}

export function titleCollection(progress: UserTitleProgress, earned: readonly string[], equipped: string | null): UserTitleCollection {
  const options = userTitleOptions(progress, earned);
  return { equipped, active: resolveUserTitle(options, equipped), options };
}

export function progressionTitle(watches: number) {
  return [...USER_TITLE_DEFS].reverse().find(def => def.metric === 'watches' && watches >= def.target)?.name || 'Начинающий зритель';
}
