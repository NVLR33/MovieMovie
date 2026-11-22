import { CheckCircle2, Sparkles } from 'lucide-react';
import type { UnlockedHiddenAchievement } from '@/lib/hidden-achievement-types';
import OwnershipBadge from './ownership-badge';

export default function HiddenTrophies({ awards, compact = false }: { awards: readonly UnlockedHiddenAchievement[]; compact?: boolean }) {
  if (!awards.length) return null;
  return (
    <section className={`hidden-trophies ${compact ? 'hidden-trophies-compact' : ''}`} aria-label="Открытые скрытые трофеи">
      <div className="hidden-trophies-heading"><Sparkles size={17} /><h3>Тайное стало явным</h3><span>{awards.length}</span></div>
      {!compact && <p className="collectible-note">Эти трофеи раскрылись только после выполнения. Награды сохраняются навсегда.</p>}
      <div className="hidden-trophies-grid">{awards.map(award => (
        <article className="hidden-trophy-card" key={award.id}>
          <div className="hidden-trophy-top"><span className="hidden-trophy-icon" aria-hidden="true">{award.icon}</span><span><CheckCircle2 size={12} />СЕКРЕТ РАСКРЫТ</span></div>
          <h4>{award.name}</h4>
          {!compact && <p>{award.description}</p>}
          <OwnershipBadge stats={award.community} compact={compact} />
          <small>Открыто {new Date(award.unlockedAt).toLocaleDateString('ru-RU', { timeZone: award.timeZone })}{!compact && ` · ${award.timeZone}`}</small>
        </article>
      ))}</div>
    </section>
  );
}
