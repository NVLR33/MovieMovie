'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Clapperboard, Coins, Eye, EyeOff, Film, Heart, Sparkles } from 'lucide-react';
import CinemaPetArt from './cinema-pet-art';
import PopcornWallet from './popcorn-wallet';
import { popcornAccrual } from '@/lib/popcorn-economy';
import { PET_ACTIVITY, PET_CARE, PET_ITEMS, PET_LEVEL_XP, PET_QUESTS, PET_STAGE_LEVELS, PET_STAGE_NAMES, PET_UPGRADES, petProgress, petStageName, type PetSnapshot, type PetPublic } from '@/lib/cinema-pet';



export function PublicCinemaPet({ userId }: { userId: number }) {
  const [pet, setPet] = useState<{ userId: number; data: PetPublic } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/pet?userId=${userId}`, { cache: 'no-store', signal: controller.signal }).then(r => r.ok ? r.json() : null).then(result => { if (!controller.signal.aborted && result?.pet) setPet({ userId, data: result.pet }); }).catch(() => {});
    return () => controller.abort();
  }, [userId]);
  if (pet?.userId !== userId) return null;
  const p = pet.data;
  return <section className={`public-cinema-pet pet-theme-${p.theme}`} aria-label="Кинопитомец"><CinemaPetArt {...p} /><div><span className="eyebrow">КИНОСПУТНИК</span><h3>{p.name}</h3><p>{petStageName(p.experience, p.branch)} · уровень {p.level}</p><small>Личный питомец киномана. Баланс и история действий приватны.</small></div></section>;
}

export default function CinemaPetStudio({ go }: { go: (url: string) => void }) {
  const [pet, setPet] = useState<PetSnapshot | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState('care');
  const [receivedAt, setReceivedAt] = useState(0);
  const [clock, setClock] = useState(0);
  const pending = useRef(false);
  const snapshotVersion = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    const version = snapshotVersion.current;
    void fetch('/api/pet', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить питомца');
      if (!controller.signal.aborted && version === snapshotVersion.current) { setPet(data.pet); setReceivedAt(Date.now()); setClock(Date.now()); setError(''); }
    }).catch(e => { if (!controller.signal.aborted && version === snapshotVersion.current) setError(e instanceof Error ? e.message : 'Ошибка загрузки'); });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    const refresh = () => { if (!pending.current && document.visibilityState === 'visible') setRevision(r => r + 1); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now(); setClock(now);
      // Refresh UTC-bound missions after midnight, even if the profile stays open.
      if (pet && receivedAt && !pending.current && new Date(Date.parse(pet.serverNow) + Math.max(0, now - receivedAt)).toISOString().slice(0, 10) !== pet.serverNow.slice(0, 10)) setRevision(r => r + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, [pet, receivedAt]);
  const mutate = async (body: Record<string, unknown>) => {
    if (pending.current) return;
    pending.current = true; snapshotVersion.current++; setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/pet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось сохранить');
      setPet(data.pet); setReceivedAt(Date.now()); setClock(Date.now());
      setMessage(body.action === 'adopt' ? 'Ваше кино-приключение начинается! +30 попкорна на знакомство.' : body.action === 'weekly' || body.action === 'milestone' ? 'Бонус зачислен в кошелёк!' : 'Готово! Развитие сохранено.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Ошибка соединения'); }
    finally { pending.current = false; setBusy(false); }
  };
  const progress = petProgress(pet?.experience || 0);
  const simulatedNow = pet && receivedAt ? new Date(new Date(pet.serverNow).getTime() + Math.max(0, clock - receivedAt)) : new Date(0);
  const production = popcornAccrual(pet?.lastCollectedAt ?? null, pet?.projectorLevel || 0, simulatedNow, pet?.productionCarry || 0);
  const tabs = [{ id: 'wallet', label: 'Попкорн и кошелёк' }, { id: 'care', label: 'Забота и миссии' }, { id: 'studio', label: 'Домашний кинозал' }, { id: 'shop', label: 'Гардероб' }, { id: 'journey', label: 'Эволюция и история' }];
  return <section className={`cinema-pet-studio pet-theme-${pet?.theme || 'classic'}`} aria-label="Кино-Эволюция" aria-busy={busy}>
    <header className="pet-section-heading"><div><span className="eyebrow">ЛИЧНАЯ КИНО-ЭВОЛЮЦИЯ</span><h2>Твой маленький <em>большой зритель.</em></h2><p>Кино превращается в попкорн. Попкорн — в приключения.</p></div>{pet && <button type="button" className="pet-wallet" aria-label={`Открыть кошелёк. Баланс: ${pet.balance} попкорна`} aria-pressed={tab === 'wallet'} onClick={() => setTab(t => t === 'wallet' ? 'care' : 'wallet')}><Coins size={20} /><b>{pet.balance.toLocaleString('ru-RU')}</b><small>попкорна</small></button>}</header>
    {error && <div className="pet-error" role="alert">{error}<button type="button" className="outline-btn small" disabled={busy} onClick={() => setRevision(r => r + 1)}>Обновить</button></div>}
    {!pet && !error && <p role="status">Загружаем киновселенную питомца…</p>}
    {pet && !pet.adopted && <div className="pet-adoption"><CinemaPetArt experience={0} branch="director" /><div><h3>Знакомься: Поппи.</h3><p>Пока это маленькое зёрнышко. Смотри кино, делись впечатлениями и помоги ему стать Режиссёром легенд или Кино-монстром.</p><ul><li>12 уровней и 6 форм, два финальных образа.</li><li>Домашний проектор накапливает попкорн до 24 часов.</li><li>Питомец не голодает, не умирает и не теряет прогресс.</li></ul><button type="button" className="primary-btn" disabled={busy} onClick={() => void mutate({ action: 'adopt' })}><Heart size={16} />Начать дружбу · +30 попкорна</button></div></div>}
    {pet?.adopted && <>
      <div className="pet-main-layout"><div className="pet-habitat"><div className="pet-habitat-top"><span><Clapperboard size={14} />PERSONAL CINEMA</span><b>LVL {progress.level}</b></div><CinemaPetArt {...pet} /><div className="pet-nameplate"><h3>{pet.name}</h3><p>{petStageName(pet.experience, pet.branch)}</p><span>{pet.showInProfile ? <><Eye size={13} />Виден в профиле</> : <><EyeOff size={13} />Только для тебя</>}</span></div></div>
        <div className="pet-overview"><div className="pet-level-heading"><span>Уровень {progress.level} / 12</span><b>{pet.experience} киноопыта</b></div><div className="bar-track pet-xp-track"><i style={{ width: `${progress.percentage}%` }} /></div><p>{progress.next === null ? 'Финальная форма открыта. Забота и новые истории продолжаются.' : `Ещё ${Math.max(0, progress.next - pet.experience)} опыта до следующего уровня.`}</p>
          <div className="pet-projector"><Film size={24} /><div><h4>Проектор работает, пока ты занят</h4><p>{production.rate} попкорна / час · запас до {production.capacity}</p><b>{production.pending} готово к сбору</b></div><button type="button" className="primary-btn small" disabled={busy || production.pending < 1} onClick={() => void mutate({ action: 'collect' })}>Забрать</button></div>
          <p className="pet-small-note">Сумму подтверждает сервер. Без потери уровней, серий входа и штрафов за отсутствие. Попкорн нельзя купить за деньги или передать другому пользователю.</p>
          <details className="pet-personalize"><summary>Имя, ветка развития и видимость</summary><form key={`${pet.name}:${pet.branch}:${pet.showInProfile}`} onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void mutate({ action: 'customize', name: String(data.get('name') || ''), branch: String(data.get('branch')), showInProfile: data.get('visible') === 'on' }); }}><label>Имя питомца<input name="name" defaultValue={pet.name} required maxLength={24} /></label><label>Финальный образ<select name="branch" defaultValue={pet.branch}><option value="director">Режиссёр легенд</option><option value="monster">Кино-монстр</option></select></label><label className="pet-checkbox"><input name="visible" type="checkbox" defaultChecked={pet.showInProfile} />Показывать питомца другим зрителям</label><button type="submit" className="outline-btn small" disabled={busy}>Сохранить образ</button></form></details>
        </div>
      </div>
      <div className="pet-tabs" role="group" aria-label="Раздел питомца">{tabs.map(t => <button type="button" key={t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>
      {tab === 'care' && <div className="pet-care-layout"><div><h3>Маленький ритуал, не обязанность</h3><p className="pet-small-note">Каждое действие — не чаще раза в день по UTC. Забота тратит попкорн и даёт только опыт питомцу.</p><div className="pet-action-grid">{Object.entries(PET_CARE).map(([kind, policy]) => { const done = pet.cared.includes(kind), locked = progress.level < policy.level; return <button type="button" key={kind} className="pet-care-action" disabled={busy || done || locked || pet.balance < policy.cost} onClick={() => void mutate({ action: 'care', kind })}><span>{kind === 'feed' ? '🍿' : kind === 'play' ? '🎞️' : '🎬'}</span><b>{policy.label}</b><small>{done ? 'Сегодня уже сделано' : locked ? `С ${policy.level} уровня` : `${policy.cost} попкорна · +${Math.floor(policy.xp * (1 + pet.archiveLevel / 10))} опыта`}</small><small>{policy.description}</small></button>; })}</div>
        <h3 className="pet-missions-title">Миссии сегодняшнего сеанса</h3>{PET_QUESTS.map(q => { const count = pet.dailyCounts[q.id], claimed = pet.claimed.includes(q.id); return <div className="pet-quest" key={q.id}><div><b>{q.label}</b><small>{Math.min(q.target, count)} / {q.target} · +{q.popcorn} попкорна · +{q.xp} опыта</small></div><button type="button" className="outline-btn small" disabled={busy || claimed || count < q.target} onClick={() => void mutate({ action: 'quest', id: q.id })}>{claimed ? <><Check size={14} />Получено</> : 'Забрать награду'}</button></div>; })}
        <button type="button" className="outline-btn small" onClick={() => go('/catalog')}>Выбрать новую историю →</button></div><aside className="pet-earning"><h3>Откуда берётся попкорн</h3>{Object.entries(PET_ACTIVITY).map(([kind, policy]) => <div key={kind}><b>+{policy.popcorn}</b><span>{policy.label}<small>{Math.min(pet.dailyCounts[kind as keyof typeof PET_ACTIVITY], policy.dailyLimit)} / {policy.dailyLimit} наград сегодня</small></span></div>)}<p>Один материал — одна награда каждого типа за всё время. Повторы, ответы и короткие реплики не приносят валюту. Дневные лимиты и миссии сбрасываются по UTC. Историческая активность до запуска не пересчитывается.</p></aside></div>}
      {tab === 'studio' && <div className="pet-upgrade-grid">{Object.entries(PET_UPGRADES).map(([kind, upgrade]) => { const level = kind === 'projector' ? pet.projectorLevel : pet.archiveLevel, price = upgrade.prices[level]; return <article className="pet-upgrade" key={kind}><span>{kind === 'projector' ? <Film size={28} /> : <Clapperboard size={28} />}</span><h3>{upgrade.label}</h3><p>{upgrade.description}</p><b>Уровень {level} / {upgrade.prices.length}</b><div className="pet-upgrade-pips">{upgrade.prices.map((_, i) => <i className={i < level ? 'filled' : ''} key={i} />)}</div><button type="button" className="outline-btn" disabled={busy || price === undefined || pet.balance + (kind === 'projector' ? production.pending : 0) < price} onClick={() => void mutate({ action: 'upgrade', kind, expectedLevel: level })}>{price === undefined ? 'Максимальное улучшение' : `Улучшить за ${price} попкорна`}</button></article>; })}</div>}
      {tab === 'shop' && <><p className="pet-small-note">Только оформление: предметы не дают преимуществ в общем рейтинге. Покупка сразу примеряет предмет; повторно платить не нужно.</p><div className="pet-shop-reset"><button type="button" className="outline-btn small" disabled={busy} onClick={() => void mutate({ action: 'equip', id: 'theme:classic' })}>Классический зал · бесплатно</button><button type="button" className="outline-btn small" disabled={busy} onClick={() => void mutate({ action: 'equip', id: 'accessory:none' })}>Снять аксессуар</button></div><div className="pet-shop-grid">{PET_ITEMS.map(item => { const owned = pet.owned.includes(item.id), equipped = item.id === `theme:${pet.theme}` || item.id === `accessory:${pet.accessory}`; return <article key={item.id} className={`pet-shop-item ${item.id.startsWith('theme:') ? `pet-theme-${item.id.split(':')[1]}` : ''}`}><div className="pet-shop-preview">{item.id.startsWith('accessory:') ? <CinemaPetArt experience={pet.experience} branch={pet.branch} accessory={item.id.split(':')[1]} /> : <span><Sparkles size={30} />{item.label}</span>}</div><h4>{item.label}</h4><button type="button" className="outline-btn small" disabled={busy || equipped || (!owned && pet.balance < item.price)} onClick={() => void mutate({ action: owned ? 'equip' : 'buy', id: item.id })}>{equipped ? 'Выбрано' : owned ? 'Надеть' : `${item.price} попкорна`}</button></article>; })}</div></>}
      {tab === 'journey' && <div className="pet-journey-layout"><div><h3>От зёрнышка до большой премьеры</h3><div className="pet-evolution-road">{PET_STAGE_LEVELS.map((level, stage) => <div key={level} className={progress.stage >= stage ? 'is-open' : ''}><CinemaPetArt experience={PET_LEVEL_XP[level - 1]} branch={pet.branch} /><b>{stage === 5 ? (pet.branch === 'director' ? 'Режиссёр легенд' : 'Кино-монстр') : PET_STAGE_NAMES[stage]}</b><small>Уровень {level} · {PET_LEVEL_XP[level - 1]} опыта</small></div>)}</div></div><div><h3>Журнал последних действий</h3>{pet.ledger.length ? <ol className="pet-ledger">{pet.ledger.map(e => <li key={e.id}><div><b>{e.label}</b><small>{new Date(e.createdAt).toLocaleString('ru-RU')}</small></div><span>{e.delta > 0 ? '+' : ''}{e.delta} 🍿{e.experienceDelta > 0 && <small>+{e.experienceDelta} опыта</small>}</span></li>)}</ol> : <p>Новая история ещё впереди.</p>}</div></div>}
    </>}
    {pet && tab === 'wallet' && <PopcornWallet pet={pet} busy={busy} mutate={mutate} />}
    <div className="pet-feedback" role="status" aria-live="polite">{message}</div>
  </section>;
}
