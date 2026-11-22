import { popcornAccrual, type PopcornEconomy, type PopcornEntry } from './popcorn-economy';

// All prices/rewards are server-owned. Popcorn is a game currency, never money or user XP.
export const PET_LEVEL_XP = [0, 30, 80, 160, 280, 440, 650, 950, 1350, 1900, 2600, 3500] as const;
export const PET_STAGE_LEVELS = [1, 3, 5, 7, 9, 12] as const;
export const PET_STAGE_NAMES = ['Зёрнышко', 'Первый хлопок', 'Попкорныш', 'Киноспутник', 'Звезда сеанса', 'Легенда экрана'] as const;
export type PetBranch = 'director' | 'monster';
export const PET_ACTIVITY = {
  watch: { label: 'Первый просмотр материала', popcorn: 10, xp: 6, dailyLimit: 5 },
  rate: { label: 'Первая оценка материала', popcorn: 2, xp: 2, dailyLimit: 10 },
  review: { label: 'Отдельный отзыв от 80 символов', popcorn: 5, xp: 8, dailyLimit: 3 },
  catalog: { label: 'Принятое предложение в каталог', popcorn: 20, xp: 15, dailyLimit: 1 },
} as const;
export type PetActivity = keyof typeof PET_ACTIVITY;
export const PET_CARE = {
  feed: { label: 'Угостить', description: 'Попкорн и тёплый сеанс', cost: 8, xp: 10, level: 1 },
  play: { label: 'Поиграть', description: 'Репетиция кино-приключения', cost: 12, xp: 16, level: 1 },
  train: { label: 'Обучить', description: 'Мастер-класс по кинематографу', cost: 20, xp: 30, level: 3 },
} as const;
export type PetCare = keyof typeof PET_CARE;
export const PET_UPGRADES = {
  projector: { label: 'Проектор', description: '+1 попкорн в час за уровень', prices: [60, 120, 240, 400, 650] },
  archive: { label: 'Киноархив', description: '+10% опыта питомца от заботы за уровень', prices: [80, 180, 350] },
} as const;
export const PET_ITEMS = [
  { id: 'theme:neon', label: 'Неоновый кинозал', price: 120 },
  { id: 'theme:retro', label: 'Старый кинотеатр', price: 180 },
  { id: 'theme:cosmic', label: 'Космическая премьера', price: 300 },
  { id: 'accessory:bowtie', label: 'Бабочка', price: 40 },
  { id: 'accessory:glasses', label: '3D-очки', price: 60 },
  { id: 'accessory:cap', label: 'Режиссёрский берет', price: 180 },
  { id: 'accessory:crown', label: 'Корона кинозвезды', price: 250 },
] as const;
export const PET_QUESTS = [
  { id: 'watch', label: 'Открой новую историю', target: 1, popcorn: 6, xp: 12 },
  { id: 'rate', label: 'Две первые оценки', target: 2, popcorn: 8, xp: 18 },
  { id: 'review', label: 'Напиши содержательный отзыв', target: 1, popcorn: 12, xp: 25 },
] as const;

export function petProgress(experience: number) {
  const xp = Number.isFinite(experience) ? Math.max(0, Math.floor(experience)) : 0;
  const level = Math.max(1, PET_LEVEL_XP.filter(target => xp >= target).length);
  const stage = Math.max(0, PET_STAGE_LEVELS.filter(target => level >= target).length - 1);
  const next = PET_LEVEL_XP[level] ?? null;
  const base = PET_LEVEL_XP[level - 1];
  return { level, stage, next, percentage: next === null ? 100 : Math.min(100, (xp - base) / (next - base) * 100) };
}
export function petStageName(experience: number, branch: PetBranch) {
  const { stage } = petProgress(experience);
  return stage === 5 ? (branch === 'director' ? 'Режиссёр легенд' : 'Кино-монстр') : PET_STAGE_NAMES[stage];
}
export function petProduction(lastCollectedAt: Date | string | null, projectorLevel: number, now = new Date()) {
  const { rate, pending, capacity } = popcornAccrual(lastCollectedAt, projectorLevel, now);
  return { rate, pending, capacity };
}
export function petDay(now = new Date()) { return now.toISOString().slice(0, 10); }
export function parseOwnedItems(raw: string): string[] {
  try { const items: unknown = JSON.parse(raw); return Array.isArray(items) ? [...new Set(items.filter((id): id is string => typeof id === 'string' && PET_ITEMS.some(item => item.id === id)))] : []; }
  catch { return []; }
}
export type PetPublic = { name: string; experience: number; branch: PetBranch; theme: string; accessory: string; level: number; stage: number };
export type PetSnapshot = PetPublic & {
  adopted: boolean; balance: number; projectorLevel: number; archiveLevel: number; owned: string[]; showInProfile: boolean;
  productionCarry: number; economy: PopcornEconomy; lastCollectedAt: string | null; serverNow: string; pending: number; dailyCounts: Record<PetActivity, number>; cared: string[]; claimed: string[];
  ledger: PopcornEntry[];
};
