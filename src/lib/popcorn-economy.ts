// A closed-loop game currency: no cash, transfers, interest or random paid rewards.
export const POPCORN_WEEKLY = [
  { id: 'screenings', label: 'Неделя новых историй', description: 'Пять первых просмотров', requirements: { watch: 5 }, popcorn: 20 },
  { id: 'opinions', label: 'Свой взгляд', description: 'Десять первых оценок', requirements: { rate: 10 }, popcorn: 15 },
  { id: 'reviews', label: 'Есть что обсудить', description: 'Два отдельных отзыва от 80 символов', requirements: { review: 2 }, popcorn: 20 },
  { id: 'session', label: 'Полный киносеанс', description: 'Три просмотра, три оценки и один отзыв', requirements: { watch: 3, rate: 3, review: 1 }, popcorn: 25 },
] as const;
export const POPCORN_MILESTONES = [
  { id: 'watch10', label: 'Десять новых историй', kind: 'watch', target: 10, popcorn: 25 },
  { id: 'watch50', label: 'Полсотни сеансов', kind: 'watch', target: 50, popcorn: 75 },
  { id: 'watch150', label: 'Большая фильмотека', kind: 'watch', target: 150, popcorn: 150 },
  { id: 'rate25', label: 'Личный кинокритик', kind: 'rate', target: 25, popcorn: 20 },
  { id: 'rate100', label: 'Сто вердиктов', kind: 'rate', target: 100, popcorn: 60 },
  { id: 'review5', label: 'Первые пять рецензий', kind: 'review', target: 5, popcorn: 30 },
  { id: 'review20', label: 'Голос киноклуба', kind: 'review', target: 20, popcorn: 80 },
] as const;
export type PopcornCounts = Record<'watch' | 'rate' | 'review' | 'catalog', number>;
export type PopcornTotals = { earned: number; spent: number };
export type PopcornEconomy = {
  weekStart: string; weekEnd: string;
  lifetime: PopcornTotals; week: PopcornTotals;
  activity: PopcornCounts; weeklyActivity: PopcornCounts;
  claimedWeekly: string[]; claimedMilestones: string[];
};
export type PopcornEntry = { id: number; kind: string; label: string; delta: number; experienceDelta: number; createdAt: string };
export type PopcornHistory = { entries: PopcornEntry[]; nextCursor: number | null };
export type PopcornFilter = 'all' | 'income' | 'expense';
export function popcornWeek(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  return { start, end: new Date(start.getTime() + 7 * 86400000), key: start.toISOString().slice(0, 10) };
}
export function popcornRequirementsMet(counts: PopcornCounts, requirements: Partial<PopcornCounts>) {
  return Object.entries(requirements).every(([kind, target]) => counts[kind as keyof PopcornCounts] >= target!);
}
const EVENT_NAMES: Record<string, string> = {
  watch: 'Первый просмотр', rate: 'Первая оценка', review: 'Отдельный отзыв', catalog: 'Предложение принято в каталог',
  adopt: 'Знакомство с питомцем', collect: 'Домашний проектор', feed: 'Угощение', play: 'Игра с питомцем', train: 'Мастер-класс',
  quest: 'Миссия дня', purchase: 'Покупка оформления', upgrade_projector: 'Улучшение проектора', upgrade_archive: 'Улучшение киноархива',
};
export function popcornEntryLabel(kind: string, sourceKey: string, delta: number) {
  if (kind === 'weekly') return `Неделя: ${POPCORN_WEEKLY.find(q => q.id === sourceKey.split(':')[1])?.label || 'Кино-задание'}`;
  if (kind === 'milestone') return `Рубеж: ${POPCORN_MILESTONES.find(q => q.id === sourceKey.split(':')[1])?.label || 'Киноактивность'}`;
  return `${EVENT_NAMES[kind] || 'Киноактивность'}${delta === 0 && ['watch', 'rate', 'review', 'catalog'].includes(kind) ? ' · дневной лимит, без начисления' : ''}`;
}

/** Integer coin-milliseconds retain fractional output across collections AND speed changes. */
export function popcornAccrual(lastCollectedAt: Date | string | null, projectorLevel: number, now = new Date(), carry = 0) {
  const level = Number.isFinite(projectorLevel) ? Math.max(0, Math.min(5, Math.floor(projectorLevel))) : 0;
  const rate = 2 + level;
  const elapsed = lastCollectedAt === null ? 0 : now.getTime() - new Date(lastCollectedAt).getTime();
  const safeCarry = Number.isFinite(carry) ? Math.max(0, Math.min(3599999, Math.floor(carry))) : 0;
  const units = lastCollectedAt === null || !Number.isFinite(elapsed) ? 0 : Math.min(24 * rate * 3600000, Math.max(0, Math.floor(elapsed)) * rate + safeCarry);
  return { rate, pending: Math.floor(units / 3600000), capacity: 24 * rate, carry: units % 3600000 };
}
