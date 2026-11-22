'use client';
import { useState } from 'react';
import { Check, ChevronDown, Crown, LockKeyhole } from 'lucide-react';
import { resolveUserTitle, type UserTitleCollection, type UserTitleDisplay } from '@/lib/user-titles';

export function UserTitleBadge({ title }: { title?: UserTitleDisplay | null }) {
  if (!title) return null;
  return <span className="user-title-badge" data-tone={title.tone} title={title.description} aria-label={`Титул: ${title.name}`}><span aria-hidden="true">{title.icon}</span>{title.name}</span>;
}

export default function UserTitleStudio({ collection, username, action }: {
  collection?: UserTitleCollection | null;
  username: string;
  action: (payload: Record<string, unknown>, message?: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!collection) return null;
  const unlocked = collection.options.filter(option => option.unlocked).length;
  const automatic = resolveUserTitle(collection.options, null);
  const equip = async (titleId: string | null) => {
    if (busy) return;
    setBusy(true);
    try { await action({ action: 'titleEquip', titleId }, titleId === 'none' ? 'Титул скрыт' : 'Титул обновлён'); }
    finally { setBusy(false); }
  };
  return (
    <section className="user-title-studio">
      <header><div><span className="eyebrow">ЗАСЛУГИ ГОВОРЯТ ЗА ТЕБЯ</span><h2><Crown size={20} />Коллекция титулов</h2><p>Выбери приставку к нику для комментариев и профиля. Полученные титулы остаются с тобой.</p></div><button type="button" className="outline-btn small" aria-expanded={open} aria-controls="user-title-collection" onClick={() => setOpen(!open)}>{unlocked} / {collection.options.length} открыто<ChevronDown size={14} /></button></header>
      <div className="user-title-preview"><span className="user-title-avatar" aria-hidden="true">{[...username].slice(0, 2).join('').toUpperCase()}</span><div><b>{username}</b><UserTitleBadge title={collection.active} /><small>Так тебя видят другие зрители</small></div></div>
      {open && <div id="user-title-collection">
        <div className="user-title-modes" role="group" aria-label="Режим отображения титула"><button type="button" disabled={busy} aria-pressed={collection.equipped === null} onClick={() => equip(null)}>Автоматически<small>{automatic?.name}</small></button><button type="button" disabled={busy} aria-pressed={collection.equipped === 'none'} onClick={() => equip('none')}>Без титула<small>Только твой ник</small></button></div>
        {['Зрительский путь', 'Особые заслуги'].map(category => <div key={category} className="user-title-category"><h3>{category}</h3><div className="user-title-grid">{collection.options.filter(option => option.category === category).map(option => <article key={option.id} className={`user-title-option ${option.unlocked ? 'is-unlocked' : ''}`}>
          <UserTitleBadge title={option} />
          <p>{option.description}</p>
          <div className="user-title-progress"><span>{option.earned ? 'Получен навсегда' : option.unlocked ? 'Условие выполнено' : `${Math.min(option.progress, option.required)} / ${option.required}`}</span>{collection.equipped === option.id && <b><Check size={12} />Выбран</b>}</div>
          <div className="bar-track"><i style={{ width: `${option.unlocked ? 100 : Math.min(100, option.progress / Math.max(1, option.required) * 100)}%` }} /></div>
          <button type="button" disabled={busy || !option.unlocked || collection.equipped === option.id} onClick={() => equip(option.id)}>{!option.unlocked ? <><LockKeyhole size={12} />Пока закрыт</> : collection.equipped === option.id ? <><Check size={12} />Активен</> : 'Носить титул'}</button>
        </article>)}</div></div>)}
        <p className="user-title-note">Доступный по старой истории титул закрепится после выбора или нового просмотра, оценки либо отзыва. Прогресс считается по разным материалам. Франшизы и фестивальные отметки заполняет редакция, а не поиск по названию. Закрытый титул нельзя выбрать через API.</p>
      </div>}
    </section>
  );
}
