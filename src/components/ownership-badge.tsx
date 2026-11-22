import { ACHIEVEMENT_TIERS } from '@/lib/achievements';
import { formatOwnershipPercentage, RARITIES, type OwnershipStats } from '@/lib/ownership';

export default function OwnershipBadge({
  stats,
  tier,
  compact = false,
  completed = false,
}: {
  stats?: OwnershipStats;
  tier?: number;
  compact?: boolean;
  completed?: boolean;
}) {
  if (!stats || stats.percentage === null || !stats.rarity) {
    return <span className="ownership-meta ownership-pending">Статистика пока недоступна</span>;
  }
  const percentage = formatOwnershipPercentage(stats.percentage);
  const tierLabel = tier ? ACHIEVEMENT_TIERS[tier - 1] : '';
  const title = `${tierLabel ? tierLabel + '. ' : ''}${completed ? 'Выполнили' : 'Получили'} ${stats.earnedUsers} из ${stats.totalUsers} зарегистрированных пользователей (${percentage}). Редкость определяется долей владельцев.`;

  return (
    <span className={`ownership-meta ${compact ? 'ownership-compact' : ''}`} data-rarity={stats.rarity} title={title}>
      <span className="rarity-pill"><span className="rarity-dot" aria-hidden="true" />{RARITIES[stats.rarity].label}</span>
      <span className="ownership-percentage">
        {compact ? `${percentage} пользователей` : `${completed ? 'Выполнили' : 'Получили'} ${percentage} пользователей`}
        {tierLabel && <span className="ownership-tier"> · {tierLabel}</span>}
      </span>
    </span>
  );
}
