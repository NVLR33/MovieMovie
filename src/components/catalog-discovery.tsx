'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clapperboard,
  Compass,
  Drama,
  Film,
  Fingerprint,
  Layers3,
  Laugh,
  Orbit,
  Shapes,
  Sparkles,
  Swords,
  Tag,
  Tv2,
  WandSparkles,
  X,
} from 'lucide-react';
import { CATALOG_MOODS } from '@/lib/catalog-moods';
import type { CatalogOptions } from '@/lib/catalog-filter';

const quickGenres = [
  { value: 'Все жанры', ru: 'Все жанры', en: 'All genres', icon: Layers3 },
  { value: 'Драма', ru: 'Драмы', en: 'Drama', icon: Drama },
  { value: 'Комедия', ru: 'Комедии', en: 'Comedy', icon: Laugh },
  { value: 'Боевик', ru: 'Боевики', en: 'Action', icon: Swords },
  { value: 'Триллер', ru: 'Триллеры', en: 'Thrillers', icon: Fingerprint },
  { value: 'Приключения', ru: 'Приключения', en: 'Adventure', icon: Compass },
  { value: 'Фантастика', ru: 'Фантастика', en: 'Sci-fi', icon: Orbit },
  { value: 'Фэнтези', ru: 'Фэнтези', en: 'Fantasy', icon: WandSparkles },
  { value: 'Детектив', ru: 'Детективы', en: 'Mystery', icon: Fingerprint },
];
const formats = [
  { value: 'Все', ru: 'Всё', en: 'Everything', icon: Layers3 },
  { value: 'Фильм', ru: 'Фильмы', en: 'Films', icon: Film },
  { value: 'Сериал', ru: 'Сериалы', en: 'Series', icon: Tv2 },
  {
    value: 'Мультфильм',
    ru: 'Мультфильмы',
    en: 'Animated films',
    icon: Shapes,
  },
  {
    value: 'Мультсериал',
    ru: 'Мультсериалы',
    en: 'Animated series',
    icon: Clapperboard,
  },
  {
    value: 'Аниме-сериал',
    ru: 'Аниме-сериалы',
    en: 'Anime series',
    icon: Sparkles,
  },
  {
    value: 'Аниме-фильм',
    ru: 'Аниме-фильмы',
    en: 'Anime films',
    icon: Sparkles,
  },
];
export function catalogCategoryLabel(value: string, en: boolean) {
  return (
    formats.find((format) => format.value === value)?.[en ? 'en' : 'ru'] ??
    value
  );
}
export default function CatalogDiscovery({
  genre,
  category,
  counts,
  total,
  en,
  onGenre,
  onCategory,
}: {
  genre: string;
  category: string;
  counts: ReadonlyMap<string, number>;
  total: number;
  en: boolean;
  onGenre: (value: string) => void;
  onCategory: (value: string) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const helpId = useId(),
    countId = useId();
  const current = genre.toLocaleLowerCase();
  const choices = quickGenres.some(
    (item) => item.value.toLocaleLowerCase() === current,
  )
    ? quickGenres
    : [...quickGenres, { value: genre, ru: genre, en: genre, icon: Tag }];
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const measure = () =>
      setEdges({
        start: element.scrollLeft <= 2,
        end:
          element.scrollLeft + element.clientWidth >= element.scrollWidth - 2,
      });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', measure);
    };
  }, [choices.length]);
  useEffect(() => {
    const element = track.current;
    const active = element?.querySelector<HTMLButtonElement>(
      '[aria-pressed="true"]',
    );
    if (!element || !active) return;
    const box = element.getBoundingClientRect(),
      card = active.getBoundingClientRect();
    if (card.left < box.left || card.right > box.right)
      element.scrollTo({
        left: element.scrollLeft + card.left - box.left,
        behavior: 'instant',
      });
  }, [genre]);
  const shift = (direction: number) => {
    const element = track.current;
    if (element)
      element.scrollBy({
        left: direction * Math.max(136, element.clientWidth * 0.75),
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
  };
  return (
    <section
      className="catalog-discovery"
      aria-label={
        en ? 'Discover by genre and format' : 'Выбор по жанру и формату'
      }
    >
      <header className="catalog-discovery-heading">
        <div>
          <span className="eyebrow">
            {en ? 'FIND YOUR KIND OF CINEMA' : 'КИНО В ТВОЁМ ВКУСЕ'}
          </span>
          <h2>{en ? 'Where shall we start?' : 'С чего начнём?'}</h2>
          <p id={helpId}>
            {en
              ? 'Choose a genre. Tap it again to remove it; other filters stay in place.'
              : 'Выбери жанр. Повторное нажатие снимет его — остальные фильтры останутся.'}
          </p>
        </div>
        <div className="catalog-discovery-arrows">
          <button
            type="button"
            disabled={edges.start}
            aria-label={en ? 'Previous genres' : 'Предыдущие жанры'}
            onClick={() => shift(-1)}
          >
            <ArrowLeft size={17} />
          </button>
          <button
            type="button"
            disabled={edges.end}
            aria-label={en ? 'More genres' : 'Следующие жанры'}
            onClick={() => shift(1)}
          >
            <ArrowRight size={17} />
          </button>
        </div>
      </header>
      <div
        className="catalog-genre-track"
        ref={track}
        role="group"
        aria-label={en ? 'Quick genre selection' : 'Быстрый выбор жанра'}
        aria-describedby={`${helpId} ${countId}`}
      >
        {choices.map((item, index) => {
          const active = item.value.toLocaleLowerCase() === current;
          const count =
            item.value === 'Все жанры'
              ? total
              : (counts.get(item.value.toLocaleLowerCase()) ?? 0);
          return (
            <button
              key={item.value}
              type="button"
              className={`catalog-genre-tile ${count === 0 ? 'is-empty' : ''}`}
              aria-pressed={active}
              aria-label={`${en ? 'Genre' : 'Жанр'}: ${en ? item.en : item.value}`}
              aria-describedby={`${countId}-${index}`}
              onClick={() => onGenre(active ? 'Все жанры' : item.value)}
            >
              <span className="catalog-genre-tile-top">
                <span className="catalog-genre-check" aria-hidden="true">
                  {active && <Check size={12} />}
                </span>
                <small id={`${countId}-${index}`}>
                  {count}
                  <span className="catalog-visually-hidden">
                    {en
                      ? ' matching titles with other filters'
                      : ' материалов с учётом остальных фильтров'}
                  </span>
                </small>
              </span>
              <item.icon
                className="catalog-genre-icon"
                size={29}
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <b>{en ? item.en : item.ru}</b>
            </button>
          );
        })}
      </div>
      <p className="catalog-genre-count-note" id={countId}>
        {en
          ? 'Counts include your other filters, but not the selected genre.'
          : 'Счётчики учитывают остальные фильтры, но не выбранный жанр.'}
      </p>
      <div className="catalog-format-section">
        <span className="catalog-control-label">
          {en ? 'Format' : 'Что смотрим'}
        </span>
        <div
          className="catalog-format-choices catalog-categories"
          role="group"
          aria-label={en ? 'Content type' : 'Тип материала'}
        >
          {formats.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={category === item.value}
              onClick={() =>
                onCategory(category === item.value ? 'Все' : item.value)
              }
            >
              <item.icon size={15} aria-hidden="true" />
              {en ? item.en : item.ru}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
export function CatalogActiveFilters({
  options,
  en,
  onRemove,
  onReset,
}: {
  options: CatalogOptions;
  en: boolean;
  onRemove: (key: keyof CatalogOptions) => void;
  onReset: () => void;
}) {
  const filters: { key: keyof CatalogOptions; label: string; value: string }[] =
    [];
  if (options.query.trim())
    filters.push({
      key: 'query',
      label: en ? 'Search' : 'Поиск',
      value: options.query.trim(),
    });
  if (options.category !== 'Все')
    filters.push({
      key: 'category',
      label: en ? 'Format' : 'Тип',
      value: catalogCategoryLabel(options.category, en),
    });
  if (options.genre !== 'Все жанры')
    filters.push({
      key: 'genre',
      label: en ? 'Genre' : 'Жанр',
      value: options.genre,
    });
  if (options.mood !== 'all')
    filters.push({
      key: 'mood',
      label: en ? 'Mood' : 'Настроение',
      value:
        CATALOG_MOODS.find((item) => item.id === options.mood)?.[
          en ? 'en' : 'label'
        ] ?? options.mood,
    });
  if (options.studio !== 'Все студии')
    filters.push({
      key: 'studio',
      label: en ? 'Studio' : 'Студия',
      value: options.studio,
    });
  if (options.year !== 'Любой год')
    filters.push({
      key: 'year',
      label: en ? 'Year' : 'Год',
      value:
        options.year === 'before1960'
          ? en
            ? 'Before 1960'
            : 'До 1960'
          : options.year,
    });
  if (options.minRating !== '0')
    filters.push({
      key: 'minRating',
      label: en ? 'Rating' : 'Рейтинг',
      value: `${options.minRating}+`,
    });
  if (options.watchFilter !== 'all')
    filters.push({
      key: 'watchFilter',
      label: en ? 'Watch status' : 'Просмотр',
      value:
        options.watchFilter === 'watched'
          ? en
            ? 'Watched'
            : 'Просмотренные'
          : en
            ? 'Unwatched'
            : 'Непросмотренные',
    });
  if (options.sort !== 'popular')
    filters.push({
      key: 'sort',
      label: en ? 'Sort' : 'Порядок',
      value:
        options.sort === 'rating'
          ? en
            ? 'By rating'
            : 'По рейтингу'
          : options.sort === 'new'
            ? en
              ? 'Newest first'
              : 'Сначала новые'
            : en
              ? 'Oldest first'
              : 'Сначала старые',
    });
  if (!filters.length) return null;
  return (
    <div
      className="catalog-active-filters"
      role="group"
      aria-label={en ? 'Active filters' : 'Выбранные фильтры'}
    >
      <span className="catalog-control-label">
        {en ? 'Selected' : 'Выбрано'} · {filters.length}
      </span>
      <div className="catalog-active-chips">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            title={item.value}
            aria-label={`${en ? 'Remove filter' : 'Снять фильтр'}: ${item.label} — ${item.value}`}
            onClick={() => onRemove(item.key)}
          >
            <span>
              <small>{item.label}</small>
              {item.value}
            </span>
            <X size={13} aria-hidden="true" />
          </button>
        ))}
      </div>
      <button type="button" className="catalog-reset-all" onClick={onReset}>
        {en ? 'Clear filters' : 'Сбросить фильтры'}
      </button>
    </div>
  );
}
