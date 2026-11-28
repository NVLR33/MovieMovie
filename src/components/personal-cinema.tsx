'use client';

import Link from 'next/link';
import { useState, type MouseEvent, type ReactNode } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  ChevronRight,
  Heart,
  Library,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import type { Film } from '@/lib/data';
import { MATERIAL_CATEGORIES } from '@/lib/material-ranking';
import {
  emptyLibraryOptions,
  selectPersonalLibrary,
  type LibraryOptions,
} from '@/lib/personal-library';
import MaterialCover from './material-cover';
import { MaterialViewControls } from './material-view';

const englishFormats: Record<string, string> = {
  Все: 'All formats',
  Фильм: 'Films',
  Сериал: 'Series',
  Мультфильм: 'Animated films',
  Мультсериал: 'Animated series',
  'Аниме-сериал': 'Anime series',
  'Аниме-фильм': 'Anime films',
};

function follow(
  event: MouseEvent<HTMLAnchorElement>,
  href: string,
  go: (href: string) => void,
) {
  if (
    event.button !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  go(href);
}

export function PersonalNextEvening({
  films,
  go,
  en = false,
  compact = false,
  emptyReset,
}: {
  films: Film[];
  go: (href: string) => void;
  en?: boolean;
  compact?: boolean;
  emptyReset?: () => void;
}) {
  const [cursor, setCursor] = useState(0);
  const index = cursor % Math.max(1, films.length),
    film = films[index];
  return (
    <section
      className={`personal-evening ${compact ? 'is-compact' : ''}`}
      aria-label={en ? 'From your collection' : 'Из твоей коллекции'}
    >
      <header>
        <span className="eyebrow">
          <Bookmark size={13} />
          {en ? 'SAVED BY YOU' : 'СОХРАНЕНО ТОБОЙ'}
        </span>
        {film && (
          <span className="personal-evening-position">
            {String(index + 1).padStart(2, '0')} / {films.length}
          </span>
        )}
      </header>
      {film ? (
        <>
          <div className="personal-evening-story">
            <MaterialCover
              film={film}
              preview={false}
              className="personal-evening-cover"
            />
            <div>
              <span className="personal-evening-meta">
                {film.year} / {film.category}
              </span>
              <h2>{film.title}</h2>
              <p>{film.description}</p>
              <Link
                prefetch={false}
                href={`/movie/${film.id}`}
                onClick={(e) => follow(e, `/movie/${film.id}`, go)}
              >
                {en ? 'Take a closer look' : 'Быстрый взгляд'}
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
          <footer>
            <span>
              {en
                ? 'Your choice. Your next evening.'
                : 'Твой выбор. Твой следующий вечер.'}
            </span>
            <button
              type="button"
              aria-label={
                en ? 'Next saved story' : 'Следующая сохранённая история'
              }
              disabled={films.length < 2}
              onClick={() => setCursor((value) => value + 1)}
            >
              <ChevronRight size={19} />
            </button>
          </footer>
        </>
      ) : (
        <div className="personal-evening-empty">
          <Sparkles size={28} />
          <h2>
            {emptyReset
              ? en
                ? 'A different angle?'
                : 'Сменим ракурс?'
              : en
                ? 'Room for a new story'
                : 'Место для новой истории'}
          </h2>
          <p>
            {emptyReset
              ? en
                ? 'No saved story matches these conditions. The rest of your collection is still here.'
                : 'Под эти условия нет сохранённых историй. Остальная коллекция никуда не пропала.'
              : en
                ? 'Save a title from the catalog. It will wait for you here.'
                : 'Сохрани что-нибудь из каталога. Здесь эта история дождётся своего вечера.'}
          </p>
          {emptyReset ? (
            <button type="button" className="outline-btn" onClick={emptyReset}>
              {en ? 'Reset filters' : 'Сбросить фильтры'}
              <ArrowRight size={16} />
            </button>
          ) : (
            <Link
              prefetch={false}
              href="/catalog"
              onClick={(e) => follow(e, '/catalog', go)}
            >
              {en ? 'Discover cinema' : 'Открывать кино'}
              <ArrowUpRight size={16} />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

export function PersonalShelves({
  active,
  savedCount,
  favoriteCount,
  go,
  en = false,
}: {
  active: 'profile' | 'saved' | 'favorites';
  savedCount: number;
  favoriteCount: number;
  go: (href: string) => void;
  en?: boolean;
}) {
  return (
    <nav
      className="personal-collection-nav"
      aria-label={en ? 'My cinema shelves' : 'Полки моего кино'}
    >
      {[
        {
          href: '/profile',
          label: en ? 'My diary' : 'Кинодневник',
          icon: Library,
          count: null,
        },
        {
          href: '/watchlist',
          label: en ? 'Watch later' : 'Буду смотреть',
          icon: Bookmark,
          count: savedCount,
        },
        {
          href: '/favorites',
          label: en ? 'Favorites' : 'Любимое',
          icon: Heart,
          count: favoriteCount,
        },
      ].map((item) => (
        <Link
          key={item.href}
          prefetch={false}
          href={item.href}
          aria-current={
            item.href ===
            (active === 'profile'
              ? '/profile'
              : active === 'saved'
                ? '/watchlist'
                : '/favorites')
              ? 'page'
              : undefined
          }
          onClick={(e) => follow(e, item.href, go)}
        >
          <item.icon size={16} />
          {item.label}
          {item.count !== null && <small>{item.count}</small>}
        </Link>
      ))}
    </nav>
  );
}

export default function PersonalLibrary({
  kind,
  films,
  watched,
  ratings,
  savedCount,
  favoriteCount,
  go,
  renderGrid,
  en = false,
}: {
  kind: 'saved' | 'favorites';
  films: Film[];
  watched: ReadonlySet<number>;
  ratings: ReadonlyMap<number, number>;
  savedCount: number;
  favoriteCount: number;
  go: (href: string) => void;
  renderGrid: (films: Film[]) => ReactNode;
  en?: boolean;
}) {
  const [options, setOptions] = useState<LibraryOptions>({
    ...emptyLibraryOptions,
  });
  const update = <K extends keyof LibraryOptions>(
    key: K,
    value: LibraryOptions[K],
  ) => setOptions((current) => ({ ...current, [key]: value }));
  const filtered = selectPersonalLibrary(films, options, watched, ratings);
  const saved = kind === 'saved',
    Icon = saved ? Bookmark : Heart;
  const unviewed = films.filter((film) => !watched.has(film.id)).length;
  const unrated = films.filter(
    (film) => !(Number(ratings.get(film.id)) > 0),
  ).length;
  const hasFilters =
    options.query.trim() ||
    options.category !== 'Все' ||
    options.watch !== 'all' ||
    options.rating !== 'all';
  const reset = () => setOptions({ ...emptyLibraryOptions });
  return (
    <div className={`personal-library personal-library-${kind}`}>
      <PersonalShelves
        active={kind}
        savedCount={savedCount}
        favoriteCount={favoriteCount}
        go={go}
        en={en}
      />
      <div className="personal-library-stage">
        <header className="personal-library-intro">
          <span className="eyebrow">
            {en
              ? 'MY CINEMA / PERSONAL COLLECTION'
              : 'МОЁ КИНО / ЛИЧНАЯ КОЛЛЕКЦИЯ'}
          </span>
          <h1>
            {saved ? (en ? 'Plans for' : 'Планы на') : en ? 'Worth' : 'Хочется'}
            <br />
            <em>
              {saved
                ? en
                  ? 'an evening.'
                  : 'вечер.'
                : en
                  ? 'revisiting.'
                  : 'вернуться.'}
            </em>
          </h1>
          <p>
            {saved
              ? en
                ? 'Not another endless catalog. Stories you chose to keep for later.'
                : 'Не бесконечный каталог. Истории, которые ты сам оставил на потом.'
              : en
                ? 'Your own selection. No public votes, just what matters to you.'
                : 'Твоя собственная подборка. Не голоса публики, а то, что важно тебе.'}
          </p>
          <div className="personal-library-numbers">
            <div>
              <Icon size={16} />
              <strong>{films.length}</strong>
              <span>{en ? 'in this collection' : 'на этой полке'}</span>
            </div>
            <div>
              <strong>{unviewed}</strong>
              <span>{en ? 'not watched yet' : 'ещё не смотрел'}</span>
            </div>
            <div>
              <strong>{unrated}</strong>
              <span>{en ? 'without your rating' : 'без твоей оценки'}</span>
            </div>
          </div>
        </header>
        <PersonalNextEvening
          key={kind + JSON.stringify(options)}
          films={filtered}
          emptyReset={films.length ? reset : undefined}
          go={go}
          en={en}
        />
      </div>
      <section
        className="personal-library-desk"
        aria-label={en ? 'Your collection' : 'Твоя коллекция'}
      >
        <header className="personal-library-desk-heading">
          <div>
            <span className="eyebrow">
              {en
                ? 'A COLLECTION, NOT A BACKLOG'
                : 'КОЛЛЕКЦИЯ, А НЕ СПИСОК ДОЛГОВ'}
            </span>
            <h2>
              {saved
                ? en
                  ? 'Waiting for their moment'
                  : 'Ждут своего момента'
                : en
                  ? 'Your special stories'
                  : 'Твои особенные истории'}
            </h2>
          </div>
          <MaterialViewControls en={en} />
        </header>
        <div className="personal-library-query">
          <Search size={18} />
          <input
            aria-label={en ? 'Search your collection' : 'Поиск в коллекции'}
            value={options.query}
            placeholder={
              en
                ? 'Title or genre in this collection…'
                : 'Название или жанр на этой полке…'
            }
            onChange={(event) => update('query', event.target.value)}
          />
          {options.query && (
            <button
              type="button"
              aria-label={
                en ? 'Clear collection search' : 'Очистить поиск в коллекции'
              }
              onClick={() => update('query', '')}
            >
              <X size={17} />
            </button>
          )}
        </div>
        <div className="personal-library-controls">
          <label>
            <span>{en ? 'Format' : 'Формат'}</span>
            <select
              aria-label={en ? 'Collection format' : 'Формат коллекции'}
              value={options.category}
              onChange={(event) => update('category', event.target.value)}
            >
              {MATERIAL_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {en
                    ? englishFormats[category] || category
                    : category === 'Все'
                      ? 'Все форматы'
                      : category}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{en ? 'Watch status' : 'Просмотр'}</span>
            <select
              aria-label={
                en ? 'Collection watch status' : 'Просмотр в коллекции'
              }
              value={options.watch}
              onChange={(event) =>
                update('watch', event.target.value as LibraryOptions['watch'])
              }
            >
              <option value="all">{en ? 'All titles' : 'Все истории'}</option>
              <option value="unwatched">
                {en ? 'Not watched yet' : 'Ещё не смотрел'}
              </option>
              <option value="watched">{en ? 'Watched' : 'Просмотрено'}</option>
            </select>
          </label>
          <label>
            <span>{en ? 'Your rating' : 'Твоя оценка'}</span>
            <select
              aria-label={
                en ? 'Collection rating status' : 'Оценка в коллекции'
              }
              value={options.rating}
              onChange={(event) =>
                update('rating', event.target.value as LibraryOptions['rating'])
              }
            >
              <option value="all">
                {en ? 'Any rating status' : 'Все истории'}
              </option>
              <option value="unrated">
                {en ? 'Without my rating' : 'Без моей оценки'}
              </option>
              <option value="rated">{en ? 'Rated by me' : 'Я оценил'}</option>
            </select>
          </label>
          <label>
            <span>{en ? 'Sort order' : 'Порядок'}</span>
            <select
              aria-label={en ? 'Collection sort order' : 'Порядок коллекции'}
              value={options.sort}
              onChange={(event) =>
                update('sort', event.target.value as LibraryOptions['sort'])
              }
            >
              <option value="collection">
                {en ? 'Catalog order' : 'Как в каталоге'}
              </option>
              <option value="mine">{en ? 'My rating' : 'Моя оценка'}</option>
              <option value="rating">
                {en ? 'Community rating' : 'Оценка сообщества'}
              </option>
              <option value="year">
                {en ? 'Newest releases' : 'Год: сначала новые'}
              </option>
              <option value="title">
                {en ? 'Alphabetically' : 'По названию'}
              </option>
            </select>
          </label>
        </div>
        <div className="personal-library-results">
          <p role="status" aria-live="polite">
            {en ? 'On screen' : 'На экране'} <strong>{filtered.length}</strong>{' '}
            / {films.length}
          </p>
          {hasFilters && (
            <button type="button" onClick={reset}>
              <SlidersHorizontal size={14} />
              {en ? 'Reset filters' : 'Сбросить фильтры'}
            </button>
          )}
        </div>
        {filtered.length ? (
          renderGrid(filtered)
        ) : (
          <div className="empty-state">
            <Icon size={34} />
            <h3>
              {films.length
                ? en
                  ? 'No matches on this shelf'
                  : 'На этой полке нет совпадений'
                : saved
                  ? en
                    ? 'An evening still to be planned'
                    : 'Вечер ещё не запланирован'
                  : en
                    ? 'Your favorites start here'
                    : 'Любимое начинается здесь'}
            </h3>
            <p>
              {films.length
                ? en
                  ? 'Try another query or remove a condition. Your collection stays intact.'
                  : 'Попробуй другой запрос или убери условие. Сама коллекция остаётся на месте.'
                : en
                  ? 'Save a story you want to return to.'
                  : 'Сохрани историю, к которой захочется вернуться.'}
            </p>
            <button
              type="button"
              className="primary-btn"
              onClick={() => (films.length ? reset() : go('/catalog'))}
            >
              {films.length
                ? en
                  ? 'Show the whole collection'
                  : 'Показать всю коллекцию'
                : en
                  ? 'Explore the catalog'
                  : 'Исследовать каталог'}
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
