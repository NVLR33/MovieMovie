'use client';

import { useEffect, useRef, useState } from 'react';
import { Coins, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { PET_ITEMS, PET_UPGRADES, type PetSnapshot } from '@/lib/cinema-pet';
import { POPCORN_MILESTONES, POPCORN_WEEKLY, popcornRequirementsMet, type PopcornCounts, type PopcornFilter, type PopcornHistory } from '@/lib/popcorn-economy';

type Props = { pet: PetSnapshot; busy: boolean; mutate: (body: Record<string, unknown>) => Promise<void> };
const n = (value: number) => value.toLocaleString('ru-RU');
const COUNT_NAMES: Record<keyof PopcornCounts, string> = { watch: 'просмотры', rate: 'оценки', review: 'отзывы', catalog: 'предложения' };

function WalletHistory({ filter }: { filter: PopcornFilter }) {
  const [history, setHistory] = useState<PopcornHistory>({ entries: [], nextCursor: null });
  const [cursor, setCursor] = useState<number | undefined>();
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pending = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    pending.current = true;
    const url = `/api/pet?history=1&filter=${filter}${cursor === undefined ? '' : `&cursor=${cursor}`}`;
    void fetch(url, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить историю');
      if (!controller.signal.aborted) setHistory(previous => ({ entries: cursor === undefined ? data.entries : [...previous.entries, ...data.entries], nextCursor: data.nextCursor }));
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Ошибка соединения'); })
      .finally(() => { if (!controller.signal.aborted) { setLoading(false); pending.current = false; } });
    return () => controller.abort();
  }, [filter, cursor, attempt]);
  return <>
    {history.entries.length > 0 && <ol className="pet-ledger popcorn-history">{history.entries.map(e => <li key={e.id}><div><b>{e.label}</b><small>{new Date(e.createdAt).toLocaleString('ru-RU')} · операция №{e.id}</small></div><span className={e.delta < 0 ? 'is-expense' : ''}>{e.delta > 0 ? '+' : ''}{n(e.delta)} 🍿{e.experienceDelta > 0 && <small>+{e.experienceDelta} опыта питомца</small>}</span></li>)}</ol>}
    {error && <p className="pet-error" role="alert">{error}<button className="outline-btn small" type="button" disabled={loading} onClick={() => { setError(''); setLoading(true); setAttempt(a => a + 1); }}>Повторить загрузку</button></p>}
    {loading && <p className="pet-small-note" role="status">Загружаем операции…</p>}
    {!loading && !error && !history.entries.length && <p className="pet-small-note">В этой категории пока нет операций.</p>}
    {!error && history.nextCursor !== null && <button type="button" className="outline-btn small" disabled={loading} onClick={() => { if (pending.current) return; pending.current = true; setLoading(true); setCursor(history.nextCursor!); }}>Ещё 20 операций</button>}
  </>;
}

export default function PopcornWallet({ pet, busy, mutate }: Props) {
  const [filter, setFilter] = useState<PopcornFilter>('all');
  const [goalId, setGoalId] = useState('');
  const economy = pet.economy;
  const goals = [
    ...Object.entries(PET_UPGRADES).flatMap(([kind, upgrade]) => {
      const level = kind === 'projector' ? pet.projectorLevel : pet.archiveLevel;
      const price = upgrade.prices[level];
      return price === undefined ? [] : [{ id: `${kind}:${level}`, label: `${upgrade.label} · уровень ${level + 1}`, price, purchase: { action: 'upgrade', kind, expectedLevel: level } as Record<string, unknown> }];
    }),
    ...PET_ITEMS.filter(item => !pet.owned.includes(item.id)).map(item => ({ id: item.id, label: item.label, price: item.price, purchase: { action: 'buy', id: item.id } as Record<string, unknown> })),
  ];
  const goal = goals.find(item => item.id === goalId) || goals[0];
  const weekLabel = new Date(economy.weekStart).toLocaleDateString('ru-RU', { timeZone: 'UTC', day: 'numeric', month: 'long' });
  const endLabel = new Date(economy.weekEnd).toLocaleString('ru-RU', { timeZone: 'UTC', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  return <div className="popcorn-wallet-panel">
    <header className="popcorn-intro"><div><span className="eyebrow">ПОПКОРН · ТВОЙ КИНОБЮДЖЕТ</span><h3>Копи на свою большую премьеру</h3><p className="pet-small-note">Одна валюта для заботы, кинозала и оформления. Покупки навсегда, без подписок и случайных призов. Общий XP не расходуется.</p></div><Coins size={30} aria-hidden="true" /></header>
    <div className="popcorn-stats">
      <article><span>Доступно сейчас</span><b>{n(pet.balance)} 🍿</b><small>Накопления не сгорают</small></article>
      <article><span><TrendingUp size={14} />Доход за неделю</span><b>+{n(economy.week.earned)}</b><small>Всего заработано: {n(economy.lifetime.earned)}</small></article>
      <article><span><TrendingDown size={14} />Расход за неделю</span><b>−{n(economy.week.spent)}</b><small>Всего потрачено: {n(economy.lifetime.spent)}</small></article>
    </div>
    <div className="popcorn-budget-grid">
      <section className="popcorn-card popcorn-goal"><h4><Target size={17} />На что копим?</h4>{goal ? <>
        <label>Цель этого сеанса<select value={goal.id} onChange={e => setGoalId(e.target.value)}>{goals.map(item => <option key={item.id} value={item.id}>{item.label} · {item.price} 🍿</option>)}</select></label>
        <div className="bar-track"><i style={{ width: `${Math.min(100, pet.balance / goal.price * 100)}%` }} /></div>
        <p><b>{n(Math.min(pet.balance, goal.price))} / {n(goal.price)} 🍿</b><span>{pet.balance >= goal.price ? 'Уже хватает на покупку' : `Осталось ${n(goal.price - pet.balance)} попкорна`}</span></p>
        <button type="button" className="outline-btn small" disabled={busy || !pet.adopted || pet.balance < goal.price} onClick={() => void mutate(goal.purchase)}>{goal.purchase.action === 'upgrade' ? 'Улучшить' : 'Купить'} за {goal.price} 🍿</button>
        <small>Это план, не резерв: баланс не блокируется. Цель выбирается на время открытия профиля. Новые цены не применяются к уже купленным предметам.</small>
      </> : <p className="pet-small-note">Все текущие улучшения и предметы уже открыты. Можно копить дальше или заботиться о питомце.</p>}</section>
      <section className="popcorn-card"><h4>Зарабатывай в своём темпе</h4><p className="pet-small-note">Базовые награды — за первые действия с материалом, не за повторы. Короткие реплики, ответы и перестановка оценки не дают попкорна.</p><p className="pet-small-note">Недельные задания дают до 80 🍿 сверх обычных наград. Серия входов не нужна. После понедельника 00:00 UTC начинается новая неделя, неполученные недельные бонусы не переносятся.</p><p className="pet-small-note">Для заданий и рубежей считаются только оплаченные кино-действия в пределах дневных лимитов. Проектор, покупки и другие бонусы не накручивают прогресс.</p></section>
    </div>
    {!pet.adopted && <p className="pet-small-note">Попкорн уже копится за киноактивность. Чтобы получать дополнительные награды и тратить его, начни дружбу с питомцем.</p>}
    <section className="popcorn-card"><div className="popcorn-block-heading"><h4>Кино-неделя · с {weekLabel}</h4><small>Обновится {endLabel} UTC</small></div>
      <div className="popcorn-weekly-grid">{POPCORN_WEEKLY.map(q => {
        const claimed = economy.claimedWeekly.includes(q.id), ready = popcornRequirementsMet(economy.weeklyActivity, q.requirements);
        return <article key={q.id} className={`popcorn-challenge ${claimed ? 'is-claimed' : ''}`}><b>{q.label}</b><p>{q.description}</p><div className="popcorn-requirements">{Object.entries(q.requirements).map(([kind, target]) => <small key={kind}>{COUNT_NAMES[kind as keyof PopcornCounts]}: {Math.min(target, economy.weeklyActivity[kind as keyof PopcornCounts])} / {target}</small>)}</div><strong>+{q.popcorn} 🍿</strong><button type="button" className="outline-btn small" disabled={busy || !pet.adopted || claimed || !ready} onClick={() => void mutate({ action: 'weekly', id: q.id })}>{claimed ? 'Получено' : ready ? 'Забрать бонус' : 'В процессе'}</button></article>;
      })}</div>
    </section>
    <section className="popcorn-card"><h4>Личные рубежи</h4><p className="pet-small-note">Разовые награды, без срока. Считается оплаченная активность после запуска попкорна, а не вся старая история просмотров.</p><div className="popcorn-milestones">{POPCORN_MILESTONES.map(m => {
      const count = economy.activity[m.kind], claimed = economy.claimedMilestones.includes(m.id);
      return <div className="pet-quest" key={m.id}><div><b>{m.label}</b><small>{Math.min(count, m.target)} / {m.target} · +{m.popcorn} 🍿</small></div><button type="button" className="outline-btn small" disabled={busy || !pet.adopted || claimed || count < m.target} onClick={() => void mutate({ action: 'milestone', id: m.id })}>{claimed ? 'Получено' : 'Забрать награду'}</button></div>;
    })}</div></section>
    <section className="popcorn-card"><div className="popcorn-block-heading"><h4>История попкорна</h4><div role="group" aria-label="Фильтр операций" className="popcorn-history-filters">{([['all', 'Все'], ['income', 'Доходы'], ['expense', 'Расходы']] as const).map(([id, label]) => <button type="button" className="outline-btn small" aria-pressed={filter === id} key={id} onClick={() => setFilter(id)}>{label}</button>)}</div></div><WalletHistory key={`${filter}:${pet.ledger[0]?.id || 0}`} filter={filter} /></section>
  </div>;
}
