// Server-side rules. Do not import these definitions from a client component.
import type { HiddenAchievementId } from './hidden-achievement-types';

export const hiddenAchievementDefinitions = {
  night_watch: { name: 'Ночной дозор', icon: '🦉', description: 'Отметь материал просмотренным с 03:00 до 05:00 по своему часовому поясу.' },
  against_the_current: { name: 'Против течения', icon: '🌊', description: 'Поставь 10/10, когда средняя оценка остальных пользователей ниже 4/10.' },
  steady_week: { name: 'Стабильность', icon: '🗓️', description: 'Отметь 7 разных материалов просмотренными за календарную неделю — с понедельника по воскресенье.' },
} satisfies Record<HiddenAchievementId, { name: string; icon: string; description: string }>;

export function validTrophyTimeZone(value: unknown) {
  if (typeof value !== 'string' || value.length > 100) return 'UTC';
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
  } catch { return 'UTC'; }
}

export function trophyCalendar(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (key: string) => Number(parts.find(part => part.type === key)?.value);
  const localDate = new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
  const weekday = (localDate.getUTCDay() + 6) % 7;
  localDate.setUTCDate(localDate.getUTCDate() - weekday);
  return { hour: get('hour'), weekKey: localDate.toISOString().slice(0, 10) };
}

export function qualifiesForCounterCurrent(value: number, otherRatings: { count: number; average: number | null }, previousValue?: number) {
  return value === 10 && previousValue !== 10 && otherRatings.count > 0 &&
    otherRatings.average !== null && Number.isFinite(otherRatings.average) && otherRatings.average < 4;
}
