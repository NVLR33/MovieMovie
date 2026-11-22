export const RARITIES = {
  common: { label: 'Обычная', minPercentage: 50 },
  uncommon: { label: 'Необычная', minPercentage: 20 },
  rare: { label: 'Редкая', minPercentage: 10 },
  epic: { label: 'Эпическая', minPercentage: 3 },
  legendary: { label: 'Легендарная', minPercentage: 0 },
} as const;
export type Rarity = keyof typeof RARITIES;
export type OwnershipStats = {
  earnedUsers: number;
  totalUsers: number;
  percentage: number | null;
  rarity: Rarity | null;
};

export function getOwnershipStats(earnedUsers: number, totalUsers: number): OwnershipStats {
  const total = Number.isFinite(totalUsers) ? Math.max(0, Math.floor(totalUsers)) : 0;
  const earned = Number.isFinite(earnedUsers) ? Math.min(total, Math.max(0, Math.floor(earnedUsers))) : 0;
  const percentage = total ? earned / total * 100 : null;
  const rarity = percentage === null ? null : (Object.keys(RARITIES) as Rarity[])
    .find(key => percentage >= RARITIES[key].minPercentage)!;
  return { earnedUsers: earned, totalUsers: total, percentage, rarity };
}

export function formatOwnershipPercentage(percentage: number | null) {
  if (percentage === null) return '—';
  if (percentage > 0 && percentage < 0.1) return '<0,1%';
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(percentage)}%`;
}
