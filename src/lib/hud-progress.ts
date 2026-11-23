import {
  achievementDefs,
  ACHIEVEMENT_TIERS,
  type AchievementProgress,
} from './achievements';

export const XP_PER_LEVEL = 500;
export function experienceProgress(value: number | null | undefined) {
  const total = Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : 0;
  const current = total % XP_PER_LEVEL;
  return {
    total,
    level: Math.floor(total / XP_PER_LEVEL) + 1,
    current,
    remaining: XP_PER_LEVEL - current,
    percent: (current / XP_PER_LEVEL) * 100,
  };
}
/** Closest next tier, not a fabricated daily quest or client-side XP reward. */
export function nextAchievement(progress: Partial<AchievementProgress>) {
  return (
    achievementDefs
      .flatMap((def) => {
        const raw = progress[def.id] ?? 0;
        const current = Number.isFinite(raw) ? Math.max(0, raw) : 0;
        const tier = def.targets.findIndex((target) => current < target);
        return tier < 0
          ? []
          : [
              {
                id: def.id,
                name: def.name,
                icon: def.icon,
                description: def.description,
                unit: def.unit,
                current,
                target: def.targets[tier],
                tier: ACHIEVEMENT_TIERS[tier],
                percent: (current / def.targets[tier]) * 100,
              },
            ];
      })
      .sort((a, b) => b.percent - a.percent)[0] ?? null
  );
}
