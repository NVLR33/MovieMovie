'use client';
/* eslint-disable @next/next/no-img-element */
import { useMemo, useState, type MouseEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, Crown, Eye, Film as FilmIcon, Star, Trophy } from 'lucide-react';
import type { Film } from '@/lib/data';
import {
  MATERIAL_CATEGORIES, MATERIAL_TOP_LIMITS, materialTopUrl, parseMaterialTopOptions, rankMaterials,
  type MaterialTopOptions,
} from '@/lib/material-ranking';

const categoryNames: Record<string, string> = {
  'Все': 'All titles', 'Фильм': 'Films', 'Сериал': 'Series', 'Мультфильм': 'Animated films',
  'Мультсериал': 'Animated series', 'Аниме-сериал': 'Anime series', 'Аниме-фильм': 'Anime films',
};

export default function TopMaterials({ films, go, compact = false, en = false, watchedIds }: {
  films: Film[];
  go: (url: string) => void;
  compact?: boolean;
  en?: boolean;
  watchedIds?: ReadonlySet<number>;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const [homeOptions, setHomeOptions] = useState<MaterialTopOptions>({ metric: 'rating', limit: 10, category: 'Все' });
  const options = compact ? homeOptions : parseMaterialTopOptions(params);
  const { metric, category, limit } = options;
  const ranked = useMemo(() => rankMaterials(films, { metric, category, limit }), [films, metric, category, limit]);
  const visible = compact ? ranked.materials.slice(0, 6) : ranked.materials;
  const locale = en ? 'en-US' : 'ru-RU';
  const number = (value: number) => value.toLocaleString(locale);
  const update = (patch: Partial<MaterialTopOptions>) => {
    const next = { ...options, ...patch };
    if (compact) setHomeOptions(next);
    else router.push(materialTopUrl(next), { scroll: false });
  };

  const navigate = (event: MouseEvent<HTMLAnchorElement>, url: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    go(url);
  };

  return (
    <section className={`material-top ${compact ? 'material-top-home home-section' : 'material-top-page'}`} aria-label={en ? 'Best titles' : 'Лучшие материалы'}>
      <header className="material-top-heading">
        <div>
          <span className="eyebrow">{en ? 'CHOSEN BY THE COMMUNITY' : 'ВЫБОР КИНОСООБЩЕСТВА'}</span>
          {compact ? <h2>{en ? 'Worth your' : 'Достойны твоего'} <em>{en ? 'attention.' : 'внимания.'}</em></h2> :
            <h1>{en ? 'The best' : 'Лучшие'} <em>{en ? 'titles.' : 'материалы.'}</em></h1>}
          <p>{en ? 'Films, series and animation. Real ratings. Real audience.' : 'Фильмы, сериалы и анимация. Реальные оценки. Выбор зрителей.'}</p>
        </div>
        {compact ? <a className="material-top-link" href={materialTopUrl(options)} onClick={e => navigate(e, materialTopUrl(options))}>{en ? 'Full ranking' : 'Весь топ'} <ArrowRight size={16} /></a> :
          <div className="material-top-emblem" aria-hidden="true"><Trophy size={30} /><span>TOP <b>{limit}</b></span></div>}
      </header>

      <div className="material-top-controls">
        <div className="material-metrics" role="group" aria-label={en ? 'Rank by' : 'Критерий топа'}>
          <button type="button" aria-pressed={metric === 'rating'} onClick={() => update({ metric: 'rating' })}><Star size={16} />{en ? 'By rating' : 'По рейтингу'}</button>
          <button type="button" aria-pressed={metric === 'views'} onClick={() => update({ metric: 'views' })}><Eye size={17} />{en ? 'By views' : 'По просмотрам'}</button>
        </div>
        <div className="material-limits" role="group" aria-label={en ? 'Top size' : 'Размер топа'}>
          {MATERIAL_TOP_LIMITS.map(size => compact ?
            <a key={size} href={materialTopUrl({ ...options, limit: size })} onClick={e => navigate(e, materialTopUrl({ ...options, limit: size }))}>ТОП-{size}<ArrowRight size={12} /></a> :
            <button type="button" key={size} aria-pressed={limit === size} onClick={() => update({ limit: size })}>ТОП-{size}</button>)}
        </div>
      </div>

      <div className="material-categories" role="group" aria-label={en ? 'Title category' : 'Категория материалов'}>
        {MATERIAL_CATEGORIES.map(value => <button type="button" key={value} aria-pressed={category === value} onClick={() => update({ category: value })}>{en ? categoryNames[value] : value}</button>)}
      </div>

      <div className="material-top-summary" aria-live="polite" aria-atomic="true">
        <b>{compact ? (en ? 'A taste of the top' : 'Вершина топа') : `ТОП-${limit}`} <span>· {en ? categoryNames[category] : category}</span></b>
        <span>{en ? `Showing ${visible.length} of ${number(ranked.eligibleCount)}` : `Показано ${visible.length} из ${number(ranked.eligibleCount)}`}</span>
      </div>
      <p className="material-top-method">{metric === 'rating'
        ? (en ? 'Average user rating. Ties: more votes, then more views. Only rated titles are included.' : 'По средней оценке пользователей сайта. При равенстве — по числу оценок, затем просмотров. Только материалы с оценками.')
        : (en ? 'Total views, all time. Ties: higher rating, then more votes. Only titles with views are included.' : 'По общему числу просмотров за всё время. При равенстве — по рейтингу, затем числу оценок. Только материалы с просмотрами.')}</p>

      {visible.length ? <ol className="material-ranking">
        {visible.map((film, index) => <li key={film.id} className={`material-rank-item ${index < 3 ? 'material-medalist' : ''}`} data-place={index + 1}>
          <a className="material-rank-card" href={`/movie/${film.id}`} onClick={e => navigate(e, `/movie/${film.id}`)}>
            <span className="material-place" aria-label={`${en ? 'Place' : 'Место'} ${index + 1}`}>{index === 0 && <Crown size={13} />}<b>{String(index + 1).padStart(2, '0')}</b></span>
            <span className="material-poster">{film.poster ? <img src={film.poster} alt={film.title} loading="lazy" /> : <FilmIcon size={24} aria-label={en ? 'No poster' : 'Без постера'} />}{watchedIds?.has(film.id) && <span className="material-watched" title={en ? 'Watched' : 'Просмотрено'}><CheckCircle2 size={14} /></span>}</span>
            <span className="material-info"><strong>{film.title}</strong><span className="material-subtitle">{film.year} · {en ? (categoryNames[film.category] || film.category) : film.category}</span><span className="material-genre">{film.genre}</span></span>
            <span className="material-score">
              <span title={en ? 'Average user rating' : 'Средняя оценка пользователей'} className={metric === 'rating' ? 'material-score-primary' : 'material-score-secondary'}><Star size={13} fill={metric === 'rating' ? 'currentColor' : 'none'} />{film.ratingCount > 0 ? film.rating.toFixed(1) : '—'}</span>
              {metric === 'rating' && <small>{number(film.ratingCount)} {en ? 'votes' : 'оценок'}</small>}
              <span title={en ? 'Total views' : 'Всего просмотров'} className={metric === 'views' ? 'material-score-primary' : 'material-score-secondary'}><Eye size={13} />{number(film.views || 0)}</span>
            </span>
          </a>
        </li>)}
      </ol> : <div className="material-top-empty"><Trophy size={32} /><h3>{en ? 'The top is yet to come' : 'Этот топ ещё впереди'}</h3><p>{metric === 'rating' ? (en ? 'No rated titles in this category yet. Be the first to rate one.' : 'В этой категории пока нет оценённых материалов. Стань первым, кто поставит оценку.') : (en ? 'No views in this category yet. Discover something new.' : 'В этой категории пока нет просмотров. Открой для себя новую историю.')}</p><button type="button" className="outline-btn small" onClick={() => go(category === 'Все' ? '/catalog' : `/catalog?category=${encodeURIComponent(category)}`)}>{en ? 'Explore catalog' : 'Открыть каталог'}<ArrowRight size={14} /></button></div>}

      {compact && visible.length > 0 && <a className="material-top-more" href={materialTopUrl(options)} onClick={e => navigate(e, materialTopUrl(options))}>{en ? 'Explore the full ranking' : 'Исследовать полный топ'}<ArrowRight size={16} /></a>}
      {!compact && visible.length > 0 && visible.length < limit && <p className="material-top-footnote">{en ? 'Only real titles are shown. The ranking will grow with new ratings and views.' : 'Показываем только реальные материалы. Топ будет расти вместе с новыми оценками и просмотрами.'}</p>}
    </section>
  );
}
