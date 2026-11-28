import { achievementDefs, type AchievementProgress } from "./achievements";
export type AchievementScope = "all" | "locked" | "unlocked" | "maxed";
export function achievementState(targets: readonly number[], value: number) {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0,
    tier = targets.filter((t) => safe >= t).length,
    next = targets[Math.min(tier, targets.length - 1)];
  return {
    value: safe,
    tier,
    next,
    maxed: tier === targets.length,
    percent: next ? Math.min(100, (safe / next) * 100) : 0,
  };
}
export function selectAchievements(
  progress: Partial<AchievementProgress>,
  query: string,
  category: string,
  scope: AchievementScope,
) {
  const needle = query.trim().toLocaleLowerCase();
  return achievementDefs.filter((a) => {
    const state = achievementState(a.targets, progress[a.id] || 0);
    return (
      (!needle ||
        `${a.name} ${a.description}`.toLocaleLowerCase().includes(needle)) &&
      (category === "all" || a.category === category) &&
      (scope === "all" ||
        (scope === "locked"
          ? state.tier === 0
          : scope === "unlocked"
            ? state.tier > 0
            : state.maxed))
    );
  });
}
export function nearestAchievement(progress: Partial<AchievementProgress>) {
  return (
    achievementDefs
      .map((definition, index) => ({
        definition,
        index,
        ...achievementState(definition.targets, progress[definition.id] || 0),
      }))
      .filter((a) => !a.maxed)
      .sort((a, b) => b.percent - a.percent || a.index - b.index)[0] || null
  );
}

/** Mirrors the existing genre AND category challenge condition in catalog navigation only. */
export function challengeCatalogPath(challenge: {
  filterGenre?: string | null;
  filterCategory?: string | null;
}) {
  const query = new URLSearchParams();
  if (challenge.filterGenre) query.set("genre", challenge.filterGenre);
  if (challenge.filterCategory) query.set("category", challenge.filterCategory);
  return "/catalog" + (query.size ? "?" + query.toString() : "");
}
