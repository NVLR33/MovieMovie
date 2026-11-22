import type { OwnershipStats } from './ownership';

// Types only. Locked trophy definitions must never be imported by client components.
export type HiddenAchievementId = 'night_watch' | 'against_the_current' | 'steady_week';
export type UnlockedHiddenAchievement = {
  id: HiddenAchievementId;
  name: string;
  icon: string;
  description: string;
  unlockedAt: string;
  timeZone: string;
  community: OwnershipStats;
};
