'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, Plus, Settings2, Trash2 } from 'lucide-react';
import { SERIAL_MIN_EPISODES, seriesProgress, type SeriesSeason, type SeriesSnapshot } from '@/lib/series';

type Mutation = (body: Record<string, unknown>) => Promise<boolean>;
function Rating({ value, label, busy, signedIn, auth, onChange }: {
  value: number | null; label: string; busy: boolean; signedIn: boolean; auth: () => void; onChange: (value: number | null) => void;
}) {
  return signedIn ? <select aria-label={label} disabled={busy} value={value ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}>
    <option value="">Без оценки</option>
    {Array.from({ length: 20 }, (_, i) => (i + 1) / 2).map(score => <option key={score} value={score}>{score.toFixed(1)} / 10</option>)}
  </select> : <button type="button" className="outline-btn small" onClick={auth}>Войти для оценки</button>;
}
function SeasonEditor({ season, nextNumber, busy, mutate }: { season?: SeriesSeason; nextNumber: number; busy: boolean; mutate: Mutation }) {
  const [number, setNumber] = useState(season?.number ?? nextNumber);
  const [title, setTitle] = useState(season?.title ?? '');
  const [count, setCount] = useState(season?.episodes.length || 1);
  return <form className="series-editor-form" onSubmit={event => {
    event.preventDefault();
    if (season && count < season.episodes.length && !window.confirm('Уменьшение числа эпизодов удалит лишние эпизоды и их оценки. Уже заработанные достижения сохранятся. Продолжить?')) return;
    void mutate({ action: 'saveSeason', ...(season ? { id: season.id } : {}), number, title, episodeCount: count });
  }}>
    <label>Номер сезона<input type="number" required min={1} max={100} value={number} onChange={e => setNumber(Number(e.target.value))} /></label>
    <label>Название (необязательно)<input maxLength={160} value={title} onChange={e => setTitle(e.target.value)} /></label>
    <label>Эпизодов<input type="number" required min={1} max={100} value={count} onChange={e => setCount(Number(e.target.value))} /></label>
    <button className="outline-btn small" disabled={busy} type="submit">{season ? 'Сохранить сезон' : <><Plus size={14} />Добавить сезон</>}</button>
    {season && <button className="outline-btn small danger" disabled={busy} type="button" onClick={() => {
      if (window.confirm('Удалить сезон, его эпизоды и оценки? Заработанные достижения сохранятся.')) void mutate({ action: 'deleteSeason', id: season.id });
    }}><Trash2 size={14} />Удалить сезон</button>}
  </form>;
}

export default function SeriesPanel({ movieId, userId, auth, onUpdated }: {
  movieId: number; userId: number | null; auth: () => void; onUpdated: () => Promise<void>;
}) {
  const [snapshot, setSnapshot] = useState<SeriesSnapshot | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(false);
  const url = `/api/series?movieId=${movieId}`;

  useEffect(() => {
    const controller = new AbortController();
    void fetch(url, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить сезоны');
      if (!controller.signal.aborted) { setSnapshot(data); setError(''); }
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Ошибка загрузки'); });
    return () => controller.abort();
  }, [url, userId, revision]);

  const mutate: Mutation = async body => {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/series', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, movieId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не удалось сохранить');
      const fresh = await fetch(url, { cache: 'no-store' });
      if (!fresh.ok) throw new Error('Изменения сохранены, но обновить список не удалось. Нажмите «Повторить».');
      setSnapshot(await fresh.json());
      setMessage(result.newlyCompleted ? '📚 Сериал засчитан в «Серийного маньяка»! Прогресс сохранён навсегда.' : 'Сохранено');
      if (result.newlyCompleted || ['saveSeason', 'deleteSeason'].includes(String(body.action))) await onUpdated();
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось сохранить');
      return false;
    } finally { pending.current = false; setBusy(false); }
  };

  const progress = seriesProgress(snapshot?.seasons || [], snapshot?.catalogComplete || false);
  const nextNumber = Math.max(0, ...(snapshot?.seasons || []).map(s => s.number)) + 1;
  return <section className="series-panel" aria-label="Сезоны и эпизоды" aria-busy={busy}>
    <header className="series-panel-heading"><div><span className="eyebrow">КАЖДАЯ СЕРИЯ ИМЕЕТ ЗНАЧЕНИЕ</span><h3>Сезоны и эпизоды</h3><p>Твои оценки от 0.5 до 10. Они не меняют общую оценку сериала и не начисляют XP.</p></div>
      {snapshot?.canEdit && <button type="button" className="outline-btn small" onClick={() => setEditing(!editing)}><Settings2 size={15} />{editing ? 'Закрыть редактор' : 'Редактировать сезоны'}</button>}
    </header>
    {error && <div className="series-error" role="alert">{error}<button type="button" className="outline-btn small" onClick={() => setRevision(r => r + 1)}>Повторить</button></div>}
    {!snapshot && !error && <p role="status">Загружаем сезоны…</p>}
    {snapshot && <>
      <div className={`series-completion ${snapshot.completed ? 'is-complete' : ''}`}>
        <b>{snapshot.completed ? <><CheckCircle2 size={16} />Сериал уже засчитан в достижение</> : '📚 Серийный маньяк'}</b>
        <span>Оценено {progress.rated} из {progress.total}: сезоны и эпизоды</span>
        <div className="bar-track"><i style={{ width: `${progress.total ? progress.rated / progress.total * 100 : 0}%` }} /></div>
        <small>{snapshot.completed ? 'Этот результат не пропадёт при добавлении новых сезонов или изменении оценок.' : !snapshot.catalogComplete
          ? 'Редактор ещё не подтвердил полный список сезонов и эпизодов. Ачивка пока не начисляется.'
          : progress.episodeCount < SERIAL_MIN_EPISODES ? `Для достижения нужен сериал минимум с ${SERIAL_MIN_EPISODES} эпизодами.`
          : progress.complete ? 'Все оценки на месте. Обнови любую из них, чтобы зафиксировать достижение.'
          : 'Оцени каждый сезон и каждый эпизод. Общая оценка сериала не заменяет отдельные оценки.'}</small>
      </div>
      {editing && snapshot.canEdit && <div className="series-editor">
        <h4>Структура сериала</h4><p>Укажите все сезоны и эпизоды вручную. Изменение структуры снимает подтверждение полноты. Уменьшение количества серий удаляет лишние эпизоды и их оценки.</p>
        {nextNumber <= 100 && <SeasonEditor key={nextNumber} nextNumber={nextNumber} busy={busy} mutate={mutate} />}
        <button type="button" className="outline-btn small" disabled={busy || !snapshot.seasons.length} onClick={() => {
          if (snapshot.catalogComplete || window.confirm('Подтверждаете, что внесены ВСЕ сезоны и эпизоды сериала? По этому списку будут начисляться достижения.')) void mutate({ action: 'publish', complete: !snapshot.catalogComplete });
        }}>{snapshot.catalogComplete ? 'Снять подтверждение полноты' : 'Подтвердить полный список'}</button>
      </div>}
      {!snapshot.seasons.length && <p className="series-empty">Сезоны ещё не добавлены редактором. Общее число серий из карточки не заменяет их учёт.</p>}
      <div className="series-seasons">
        {snapshot.seasons.map((season, index) => <details key={season.id} className="series-season" open={index === 0 ? true : undefined}>
          <summary><span>Сезон {season.number}{season.title ? ` · ${season.title}` : ''}<small>{season.episodes.length} эп. · оценено {season.episodes.filter(e => e.rating !== null).length}</small></span><ChevronDown size={16} /></summary>
          {editing && snapshot.canEdit && <SeasonEditor season={season} nextNumber={nextNumber} busy={busy} mutate={mutate} />}
          <div className="series-rating-row season-rating-row"><b>Твоя оценка сезона {season.number}</b><Rating value={season.rating} label={`Оценка сезона ${season.number}`} busy={busy} signedIn={snapshot.authenticated} auth={auth} onChange={value => void mutate({ action: 'rateSeason', id: season.id, value })} /></div>
          <ol className="series-episodes">{season.episodes.map(episode => <li key={episode.id}>
            <div className="series-rating-row"><span>Эпизод {episode.number}{episode.title ? ` · ${episode.title}` : ''}</span><Rating value={episode.rating} label={`Оценка: сезон ${season.number}, эпизод ${episode.number}`} busy={busy} signedIn={snapshot.authenticated} auth={auth} onChange={value => void mutate({ action: 'rateEpisode', id: episode.id, value })} /></div>
            {editing && snapshot.canEdit && <form className="series-episode-editor" onSubmit={event => {
              event.preventDefault(); const form = new FormData(event.currentTarget); void mutate({ action: 'saveEpisode', id: episode.id, title: String(form.get('title') || '') });
            }}><input aria-label={`Название: сезон ${season.number}, эпизод ${episode.number}`} name="title" defaultValue={episode.title} maxLength={160} placeholder="Название эпизода (необязательно)" /><button disabled={busy} className="outline-btn small" type="submit">Сохранить название</button></form>}
          </li>)}</ol>
        </details>)}
      </div>
    </>}
    <p className="series-message" role="status" aria-live="polite">{message}</p>
  </section>;
}
