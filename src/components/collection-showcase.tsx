'use client';
/* eslint-disable @next/next/no-img-element */
import {
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import MediaPoster, { MediaRating, MediaAge } from './media-poster';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Layers3,
  Search,
  Users,
  X,
} from 'lucide-react';
import type { Film } from '@/lib/data';
import {
  buildCinemaCollections,
  collectionShowcaseUrl,
  filterCinemaCollections,
  type CinemaCollection,
} from '@/lib/collection-showcase';
const labels = {
  all: 'Все подборки',
  studio: 'Студии',
  actor: 'Актёры',
  genre: 'Жанры',
  personal: 'Совместные',
};
const kindLabels = {
  studio: 'СТУДИЯ',
  actor: 'АКТЁРСКИЙ СОСТАВ',
  genre: 'ЖАНР',
};
const icons = { studio: Building2, actor: Users, genre: Clapperboard };
type Navigate = (event: MouseEvent<HTMLAnchorElement>, url: string) => void;
function Poster({
  film,
  watched,
  navigate,
}: {
  film: Film;
  watched: boolean;
  navigate: Navigate;
}) {
  return (
    <a
      href={`/movie/${film.id}`}
      className="showcase-film cinema-card"
      onClick={(event) => navigate(event, `/movie/${film.id}`)}
      aria-label={`${film.title}, ${film.year}${watched ? ', просмотрено' : ''}`}
    >
      <MediaPoster src={film.poster} className="showcase-poster">
        <MediaRating film={film} className="showcase-score" />
        <MediaAge value={film.ageRating} />
        {watched && (
          <span className="showcase-watched" title="Просмотрено">
            <Check size={13} />
          </span>
        )}
      </MediaPoster>
      <strong>{film.title}</strong>
      <small>
        {film.year} · {film.category}
      </small>
    </a>
  );
}
function CollectionShelf({
  group,
  view,
  watchedIds,
  signedIn,
  navigate,
  full = false,
}: {
  group: CinemaCollection<Film>;
  view: string;
  watchedIds: ReadonlySet<number>;
  signedIn: boolean;
  navigate: Navigate;
  full?: boolean;
}) {
  const track = useRef<HTMLUListElement>(null),
    [limit, setLimit] = useState(24),
    [failedBackground, setFailedBackground] = useState(false);
  const Icon = icons[group.kind],
    watched = group.films.filter((film) => watchedIds.has(film.id)).length;
  const shift = (direction: number) => {
    const list = track.current;
    if (list)
      list.scrollBy({
        left: direction * (list.clientWidth * 0.8),
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
  };
  const url = collectionShowcaseUrl(view, group.key);
  return (
    <section
      className={`collection-shelf shelf-${group.kind} ${full ? 'shelf-expanded' : ''}`}
      aria-label={`${group.kind === 'studio' ? 'Студия' : group.kind === 'actor' ? 'Актёр' : 'Жанр'}: ${group.name}`}
    >
      <div className="showcase-scenery" aria-hidden="true">
        {group.backdrop && !failedBackground && (
          <img
            src={group.backdrop}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailedBackground(true)}
          />
        )}
      </div>
      <div className="showcase-shelf-content">
        <div className="showcase-identity">
          <span className="showcase-monogram" aria-hidden="true">
            <Icon size={25} />
          </span>
          <div>
            <span className="showcase-eyebrow">
              ИЗ КАТАЛОГА · {kindLabels[group.kind]}
            </span>
            {full ? <h1>{group.name}</h1> : <h2>{group.name}</h2>}
            <p>
              {group.kind === 'studio'
                ? 'Истории с этой студией в титрах'
                : group.kind === 'actor'
                  ? 'Знакомое лицо. Разные истории.'
                  : 'Один жанр — множество поводов посмотреть.'}
            </p>
          </div>
        </div>
        <div className="showcase-shelf-heading">
          <span>
            Материалов: {group.films.length}
            {signedIn && (
              <small>
                Просмотрено {watched} из {group.films.length}
              </small>
            )}
          </span>
          {!full && (
            <a
              className="showcase-see-all"
              href={url}
              onClick={(event) => navigate(event, url)}
            >
              Смотреть все <ArrowRight size={15} />
            </a>
          )}
          {!full && group.films.length > 2 && (
            <div
              className="showcase-arrows"
              role="group"
              aria-label={`Прокрутка: ${group.name}`}
            >
              <button
                type="button"
                aria-label={`Назад: ${group.name}`}
                onClick={() => shift(-1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                aria-label={`Вперёд: ${group.name}`}
                onClick={() => shift(1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
        <ul
          ref={track}
          className={full ? 'showcase-full-grid' : 'showcase-poster-strip'}
          tabIndex={full ? undefined : 0}
          aria-label={`Материалы: ${group.name}`}
        >
          {group.films.slice(0, full ? limit : 8).map((film) => (
            <li key={film.id}>
              <Poster
                key={`${film.id}:${film.poster}`}
                film={film}
                watched={watchedIds.has(film.id)}
                navigate={navigate}
              />
            </li>
          ))}
        </ul>
        {full && (
          <footer className="showcase-paging">
            <span role="status">
              Показано {Math.min(limit, group.films.length)} из{' '}
              {group.films.length}
            </span>
            {limit < group.films.length && (
              <button
                type="button"
                onClick={() => setLimit((value) => value + 24)}
              >
                Показать ещё
              </button>
            )}
          </footer>
        )}
      </div>
    </section>
  );
}
export default function CollectionShowcase({
  films,
  go,
  watchedIds,
  signedIn,
  personal,
}: {
  films: Film[];
  go: (url: string) => void;
  watchedIds: ReadonlySet<number>;
  signedIn: boolean;
  personal: ReactNode;
}) {
  const params = useSearchParams(),
    rawView = params.get('view') || 'all',
    view = Object.hasOwn(labels, rawView) ? rawView : 'all',
    key = params.get('collection');
  const [query, setQuery] = useState(''),
    [limit, setLimit] = useState(6);
  const groups = useMemo(() => buildCinemaCollections(films), [films]);
  const filtered = useMemo(
    () => filterCinemaCollections(groups, view, query),
    [groups, view, query],
  );
  const selected = groups.find((group) => group.key === key);
  const navigate: Navigate = (event, url) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    go(url);
  };
  return (
    <div className="collection-showcase">
      {key ? (
        <>
          <a
            className="showcase-back"
            href={collectionShowcaseUrl(view)}
            onClick={(event) => navigate(event, collectionShowcaseUrl(view))}
          >
            <ArrowLeft size={16} />
            Все подборки
          </a>
          {selected ? (
            <CollectionShelf
              key={selected.key}
              group={selected}
              view={view}
              watchedIds={watchedIds}
              signedIn={signedIn}
              navigate={navigate}
              full
            />
          ) : (
            <div className="showcase-empty">
              <Layers3 size={30} />
              <h1>Подборка пока недоступна</h1>
              <p>
                В каталоге больше нет материалов с этой связью. Вернись к другим
                историям.
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <header className="showcase-page-heading">
            <span className="eyebrow">КИНО В НОВОМ КОНТЕКСТЕ</span>
            <h1>
              Истории, которые <em>объединяют.</em>
            </h1>
            <p>
              Студии с характером, знакомые актёры и любимые жанры — находи
              больше, чем один фильм.
            </p>
          </header>
          <nav className="showcase-tabs" aria-label="Виды подборок">
            {Object.entries(labels).map(([value, label]) => (
              <a
                key={value}
                href={collectionShowcaseUrl(value)}
                aria-current={view === value ? 'page' : undefined}
                onClick={(event) => {
                  if (
                    event.button === 0 &&
                    !event.metaKey &&
                    !event.ctrlKey &&
                    !event.shiftKey &&
                    !event.altKey
                  ) {
                    setQuery('');
                    setLimit(6);
                  }
                  navigate(event, collectionShowcaseUrl(value));
                }}
              >
                {label}
                {value !== 'personal' && (
                  <span>
                    {value === 'all'
                      ? groups.length
                      : groups.filter((group) => group.kind === value).length}
                  </span>
                )}
              </a>
            ))}
          </nav>
          {view === 'personal' ? (
            <div className="showcase-personal">{personal}</div>
          ) : (
            <>
              <div className="showcase-searchbar">
                <label>
                  <Search size={17} />
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setLimit(6);
                    }}
                    placeholder="Студия, актёр или жанр…"
                    aria-label="Поиск подборок"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        setLimit(6);
                      }}
                      aria-label="Очистить поиск подборок"
                    >
                      <X size={16} />
                    </button>
                  )}
                </label>
                <span role="status">Подборок: {filtered.length}</span>
              </div>
              <p className="showcase-disclaimer">
                Собраны по данным каталога, не официальные рекомендации студий
                или актёров. Отзывы и оценки — от зрителей нашего сайта.
              </p>
              {filtered.length ? (
                <div className="showcase-shelves">
                  {filtered.slice(0, limit).map((group) => (
                    <CollectionShelf
                      key={group.key}
                      group={group}
                      view={view}
                      watchedIds={watchedIds}
                      signedIn={signedIn}
                      navigate={navigate}
                    />
                  ))}
                </div>
              ) : (
                <div className="showcase-empty">
                  <Layers3 size={32} />
                  <h2>
                    {query ? 'Ничего не нашлось' : 'Новые подборки ещё впереди'}
                  </h2>
                  <p>
                    {query
                      ? 'Попробуй другое имя или сбрось поиск.'
                      : 'Подборки появятся, когда у материалов будут заполнены студии, актёры или жанры.'}
                  </p>
                  {query && (
                    <button
                      type="button"
                      className="outline-btn"
                      onClick={() => setQuery('')}
                    >
                      Сбросить поиск
                    </button>
                  )}
                </div>
              )}
              {limit < filtered.length && (
                <div className="showcase-load-more">
                  <button
                    type="button"
                    className="outline-btn"
                    onClick={() => setLimit((value) => value + 6)}
                  >
                    Ещё подборки
                  </button>
                  <span>
                    Показано {Math.min(limit, filtered.length)} из{' '}
                    {filtered.length}
                  </span>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
