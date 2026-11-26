'use client';
import MaterialCover from './material-cover';
import { useEffect, useRef, useState } from 'react';
import { Check, Clock3, Search, X } from 'lucide-react';
import { filterSuggestions, matchingSuggestionMovie, type MovieSuggestion } from '@/lib/movie-suggestions';

const labels = { pending: 'На рассмотрении', approved: 'Принято', rejected: 'Отклонено' };
const categories = ['Все', 'Фильм', 'Сериал', 'Мультфильм', 'Мультсериал', 'Аниме-сериал', 'Аниме-фильм'];
type Props = {
  suggestions: MovieSuggestion[];
  films: { id: number; title: string; year: number; category: string }[];
  review: (suggestion: MovieSuggestion) => void;
  go: (url: string) => void;
  action: (payload: Record<string, unknown>, success?: string) => Promise<boolean>;
};
function RejectSuggestion({ suggestion, close, action }: { suggestion: MovieSuggestion; close: () => void; action: Props['action'] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false), [reason, setReason] = useState('');
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog className="suggestion-reject-dialog" ref={ref} onCancel={event => { event.preventDefault(); if (!pending.current) close(); }} onClick={event => { if (event.target === event.currentTarget && !pending.current) close(); }} aria-labelledby="reject-suggestion-title">
    <form className="editor-form" onSubmit={async event => {
      event.preventDefault(); if (pending.current || !reason.trim()) return;
      pending.current = true; setBusy(true);
      try { if (await action({ action: 'rejectSuggestion', id: suggestion.id, reason }, 'Предложение отклонено, автору отправлена причина')) close(); }
      finally { pending.current = false; setBusy(false); }
    }}>
      <h2 id="reject-suggestion-title">Отклонить «{suggestion.title}»?</h2>
      <p>Заявка уйдёт из очереди в историю. Автор увидит причину и сможет подготовить новое предложение.</p>
      <label>Причина отклонения<textarea required minLength={1} maxLength={500} rows={4} value={reason} onChange={e => setReason(e.target.value)} placeholder="Например: указан неверный год или не хватает достоверной информации" /></label>
      <div className="suggestion-actions"><button type="button" className="outline-btn" disabled={busy} onClick={close}>Отмена</button><button className="primary-btn" disabled={busy || !reason.trim()}>{busy ? 'Отправляем…' : 'Подтвердить отклонение'}</button></div>
    </form>
  </dialog>;
}
export default function SuggestionsQueue({ suggestions, films, review, go, action }: Props) {
  const [status, setStatus] = useState('pending'), [category, setCategory] = useState('Все');
  const [search, setSearch] = useState(''), [sort, setSort] = useState('oldest');
  const [reject, setReject] = useState<MovieSuggestion | null>(null), [busy, setBusy] = useState<number | null>(null);
  const pending = useRef(false);
  const counts = (value: string) => suggestions.filter(s => s.status === value).length;
  const filtered = filterSuggestions(suggestions, { status, category, search, sort });
  return <section className="suggestion-workspace" aria-label="Очередь предложений">
    <header className="suggestion-workspace-heading"><div><span className="eyebrow">РЕДАКЦИЯ КАТАЛОГА</span><h2>От идеи — к премьере</h2><p>Проверь карточку, при необходимости исправь поля и опубликуй одним действием. Рассмотренные заявки остаются только в истории.</p></div><strong><Clock3 size={20} />В очереди: {counts('pending')}</strong></header>
    <div className="suggestion-status-tabs" aria-label="Статус предложений">{(['pending', 'approved', 'rejected'] as const).map(value => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>{labels[value]} <b>{counts(value)}</b></button>)}</div>
    <div className="suggestion-filters">
      <label className="suggestion-search"><span><Search size={15} /> Поиск заявок</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Название, автор или год" /></label>
      <label>Категория предложений<select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Порядок заявок<select value={sort} onChange={e => setSort(e.target.value)}><option value="oldest">Сначала старые</option><option value="newest">Сначала новые</option></select></label>
    </div>
    <p className="suggestion-result-count" role="status">Найдено: {filtered.length}{category !== 'Все' ? ` · ${category}` : ''}</p>
    <div className="suggestions-list">{filtered.map(s => {
      const existing = matchingSuggestionMovie(s, films);
      return <article className="suggestion-card suggestion-rich-card" key={s.id}>
        <MaterialCover film={{poster:s.material?.poster, title:s.title}} badges={false} preview={false} className="suggestion-poster" alt={`Постер: ${s.title}`} />
        <div className="suggestion-card-content"><div className="suggestion-card-top"><div><span className="eyebrow">{s.category} · {s.year}</span><h3>{s.title}</h3>{s.material?.originalTitle && <small>{s.material.originalTitle}</small>}<p>{s.genre || 'Жанр не указан'}</p></div><span className={`suggestion-status ${s.status}`}>{labels[s.status]}</span></div>
          <div className="suggestion-author"><button type="button" className="text-link" onClick={() => go(`/user/${s.userId}`)}>{s.author?.username || 'Пользователь'}</button><small>{new Date(s.createdAt).toLocaleDateString('ru-RU')}</small></div>
          {s.material ? <><p className="suggestion-metadata">{[s.material.country, s.material.director, `${s.material.duration} мин`, s.material.episodes ? `${s.material.episodes} серий` : '', s.material.ageRating].filter(Boolean).join(' · ')}</p><details className="suggestion-details"><summary>Описание и данные заявки</summary><p>{s.material.description}</p><dl>{[['Студия', s.material.studio], ['Актёры', s.material.cast], ['Франшиза', s.material.franchise], ['Ссылка на просмотр', s.material.watchUrl]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details></> : <p className="suggestion-legacy">{s.status === 'pending' ? 'Старая краткая заявка — перед публикацией нужно дополнить описание и обложку.' : 'Историческая краткая заявка.'}</p>}
          {s.comment && <blockquote className="suggestion-comment"><small>От автора</small>{s.comment}</blockquote>}
          {s.status === 'pending' && <div className="suggestion-actions"><button className="primary-btn small" disabled={busy !== null} onClick={() => review(s)}><Check size={15} />Проверить и одобрить</button>{existing && <button className="outline-btn small" disabled={busy !== null} onClick={async () => {
            if (pending.current) return; pending.current = true; setBusy(s.id);
            try { if (await action({ action: 'approveSuggestion', id: s.id, movieId: existing.id }, 'Заявка связана с материалом')) go(`/movie/${existing.id}`); }
            finally { pending.current = false; setBusy(null); }
          }}>Уже в каталоге — связать</button>}<button className="outline-btn small" disabled={busy !== null} onClick={() => setReject(s)}><X size={15} />Отклонить</button></div>}
          {s.reviewReason && <p className="suggestion-reason">Причина: {s.reviewReason}</p>}
          {s.reviewedAt && <small>Рассмотрено {new Date(s.reviewedAt).toLocaleDateString('ru-RU')}</small>}
          {s.status === 'approved' && s.movieId && <button className="text-link" onClick={() => go(`/movie/${s.movieId}`)}>Открыть опубликованный материал →</button>}
        </div>
      </article>;
    })}</div>
    {!filtered.length && <div className="empty-state"><Check size={30} /><h3>{status === 'pending' && !search && category === 'Все' ? 'Все заявки разобраны' : 'Нет подходящих заявок'}</h3><p>Измени категорию, поиск или вкладку истории.</p>{(search || category !== 'Все') && <button className="outline-btn" onClick={() => { setSearch(''); setCategory('Все'); }}>Сбросить фильтры заявок</button>}</div>}
    {reject && <RejectSuggestion suggestion={reject} close={() => setReject(null)} action={action} />}
  </section>;
}
