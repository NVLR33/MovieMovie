'use client';
/* eslint-disable @next/next/no-img-element */
import { useMemo, type MouseEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Crown,
  Eye,
  Heart,
  Film as FilmIcon,
  Star,
  Trophy,
} from 'lucide-react';
import type { Film } from '@/lib/data';
import { formatFilmRating } from '@/lib/rating-display';
import {
  MATERIAL_CATEGORIES,
  MATERIAL_TOP_LIMITS,
  materialTopUrl,
  parseMaterialTopOptions,
  rankMaterials,
  buildRankingLists,
  type MaterialTopOptions,
} from '@/lib/material-ranking';

const categoryNames: Record<string, string> = {
  Все: 'All titles',
  Фильм: 'Films',
  Сериал: 'Series',
  Мультфильм: 'Animated films',
  Мультсериал: 'Animated series',
  'Аниме-сериал': 'Anime series',
  'Аниме-фильм': 'Anime films',
};

function RankedMaterials({ films, go, en = false, watchedIds }: RankingProps) {
  const params = useSearchParams(),
    router = useRouter(),
    options = parseMaterialTopOptions(params);
  const { metric, category, limit } = options;
  const ranked = useMemo(
    () => rankMaterials(films, { metric, category, limit }),
    [films, metric, category, limit],
  );
  const number = (value: number) =>
    value.toLocaleString(en ? 'en-US' : 'ru-RU');
  const update = (patch: Partial<MaterialTopOptions>) =>
    router.push(materialTopUrl({ ...options, ...patch }), { scroll: false });
  const navigate = (event: MouseEvent<HTMLAnchorElement>, url: string) => {
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
    <section
      className="material-top material-top-page"
      aria-label={en ? 'Best titles' : 'Лучшие материалы'}
    >
      <a
        className="ranking-back"
        href={rankingIndexUrl(category)}
        onClick={(event) => navigate(event, rankingIndexUrl(category))}
      >
        <ArrowLeft size={16} />
        {en ? 'All ranking lists' : 'Все списки рейтингов'}
      </a>
      <header className="material-top-heading">
        <div>
          <span className="eyebrow">
            {en ? 'CHOSEN BY THE COMMUNITY' : 'ВЫБОР КИНОСООБЩЕСТВА'}
          </span>
          <h1>
            {en ? 'The best' : 'Лучшие'}{' '}
            <em>{en ? 'titles.' : 'материалы.'}</em>
          </h1>
          <p>
            {en
              ? 'Films, series and animation. Real ratings. Real audience.'
              : 'Фильмы, сериалы и анимация. Реальные оценки. Выбор зрителей.'}
          </p>
        </div>
        <div className="material-top-emblem" aria-hidden="true">
          <Trophy size={30} />
          <span>
            TOP <b>{limit}</b>
          </span>
        </div>
      </header>
      <div className="material-top-controls">
        <div
          className="material-metrics"
          role="group"
          aria-label={en ? 'Rank by' : 'Критерий топа'}
        >
          <button
            type="button"
            aria-pressed={metric === 'rating'}
            onClick={() => update({ metric: 'rating' })}
          >
            <Star size={16} />
            {en ? 'By rating' : 'По рейтингу'}
          </button>
          <button
            type="button"
            aria-pressed={metric === 'views'}
            onClick={() => update({ metric: 'views' })}
          >
            <Eye size={17} />
            {en ? 'By views' : 'По просмотрам'}
          </button>
          <button
            type="button"
            aria-pressed={metric === 'favorites'}
            onClick={() => update({ metric: 'favorites' })}
          >
            <Heart size={16} />
            {en ? 'Most favorited' : 'По любимому'}
          </button>
        </div>
        <div
          className="material-limits"
          role="group"
          aria-label={en ? 'Top size' : 'Размер топа'}
        >
          {MATERIAL_TOP_LIMITS.map((size) => (
            <button
              type="button"
              key={size}
              aria-pressed={limit === size}
              onClick={() => update({ limit: size })}
            >
              ТОП-{size}
            </button>
          ))}
        </div>
      </div>
      <div
        className="material-categories"
        role="group"
        aria-label={en ? 'Title category' : 'Категория материалов'}
      >
        {MATERIAL_CATEGORIES.map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={category === value}
            onClick={() => update({ category: value })}
          >
            {en ? categoryNames[value] : value}
          </button>
        ))}
      </div>
      <div
        className="material-top-summary"
        aria-live="polite"
        aria-atomic="true"
      >
        <b>
          ТОП-{limit} <span>· {en ? categoryNames[category] : category}</span>
        </b>
        <span>
          {en
            ? `Showing ${ranked.materials.length} of ${number(ranked.eligibleCount)}`
            : `Показано ${ranked.materials.length} из ${number(ranked.eligibleCount)}`}
        </span>
      </div>
      <p className="material-top-method">
        {metric === 'rating'
          ? en
            ? 'Average user rating. Ties: more votes, then more visits. Only rated titles are included.'
            : 'По средней оценке пользователей сайта. При равенстве — по числу оценок, затем посещений. Только материалы с оценками.'
          : metric === 'favorites'
            ? en
              ? 'Number of users who currently have the title in favorites. Ties: rating, votes, then visits.'
              : 'По числу пользователей, у которых материал сейчас в любимом. При равенстве — по рейтингу, числу оценок, затем посещений. Только материалы в любимом.'
            : en
              ? 'Title page visits, all time. Ties: higher rating, then more votes. Only titles with visits are included.'
              : 'По общему числу посещений страниц за всё время. При равенстве — по рейтингу, затем числу оценок. Только материалы с посещениями. Это не число отметок «просмотрено».'}
      </p>
      {ranked.materials.length ? (
        <ol className="material-ranking">
          {ranked.materials.map((film, index) => (
            <li
              key={film.id}
              className={`material-rank-item ${index < 3 ? 'material-medalist' : ''}`}
              data-place={index + 1}
            >
              <a
                className="material-rank-card"
                href={`/movie/${film.id}`}
                onClick={(event) => navigate(event, `/movie/${film.id}`)}
              >
                <span
                  className="material-place"
                  aria-label={`${en ? 'Place' : 'Место'} ${index + 1}`}
                >
                  {index === 0 && <Crown size={13} />}
                  <b>{String(index + 1).padStart(2, '0')}</b>
                </span>
                <span className="material-poster">
                  {film.poster ? (
                    <img src={film.poster} alt="" loading="lazy" />
                  ) : (
                    <FilmIcon
                      size={24}
                      aria-label={en ? 'No poster' : 'Без постера'}
                    />
                  )}{' '}
                  {watchedIds?.has(film.id) && (
                    <span
                      className="material-watched"
                      title={en ? 'Watched' : 'Просмотрено'}
                    >
                      <CheckCircle2 size={14} />
                    </span>
                  )}
                </span>
                <span className="material-info">
                  <strong>{film.title}</strong>
                  <span className="material-subtitle">
                    {film.year} ·{' '}
                    {en
                      ? categoryNames[film.category] || film.category
                      : film.category}
                  </span>
                  <span className="material-genre">{film.genre}</span>
                </span>
                <span className="material-score">
                  <span
                    title={
                      en
                        ? 'Average user rating'
                        : 'Средняя оценка пользователей'
                    }
                    className={
                      metric === 'rating'
                        ? 'material-score-primary'
                        : 'material-score-secondary'
                    }
                  >
                    <Star
                      size={13}
                      fill={metric === 'rating' ? 'currentColor' : 'none'}
                    />
                    {formatFilmRating(film)}
                  </span>
                  {metric === 'rating' && (
                    <small>
                      {number(film.ratingCount)} {en ? 'votes' : 'оценок'}
                    </small>
                  )}
                  {metric === 'favorites' && (
                    <span
                      title={
                        en
                          ? 'Users who added to favorites'
                          : 'Пользователей добавили в любимое'
                      }
                      className="material-score-primary"
                    >
                      <Heart size={13} fill="currentColor" />
                      {number(film.favoriteCount || 0)}
                    </span>
                  )}
                  <span
                    title={
                      en ? 'Title page visits' : 'Посещения страницы материала'
                    }
                    className={
                      metric === 'views'
                        ? 'material-score-primary'
                        : 'material-score-secondary'
                    }
                  >
                    <Eye size={13} />
                    {number(film.views || 0)}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      ) : (
        <div className="material-top-empty">
          <Trophy size={32} />
          <h3>{en ? 'The top is yet to come' : 'Этот топ ещё впереди'}</h3>
          <p>
            {en
              ? 'No eligible titles in this category yet. Explore the catalog to start this list.'
              : 'В этой категории пока нет материалов для выбранного критерия. Открой каталог — первые оценки, посещения и любимое запустят список.'}
          </p>
          <button
            type="button"
            className="outline-btn small"
            onClick={() =>
              go(
                category === 'Все'
                  ? '/catalog'
                  : `/catalog?category=${encodeURIComponent(category)}`,
              )
            }
          >
            {en ? 'Explore catalog' : 'Открыть каталог'}
            <ArrowRight size={14} />
          </button>
        </div>
      )}
      {ranked.materials.length > 0 && ranked.materials.length < limit && (
        <p className="material-top-footnote">
          {en
            ? 'Only real titles are shown. The ranking will grow with new ratings, visits and favorites.'
            : 'Показываем только реальные материалы. Топ будет расти вместе с новыми оценками, посещениями и добавлениями в любимое.'}
        </p>
      )}
    </section>
  );
}

function rankingIndexUrl(category: MaterialTopOptions['category']) {
  return category === 'Все'
    ? '/top'
    : `/top?${new URLSearchParams({ category })}`;
}

type RankingProps = {
  films: Film[];
  go: (url: string) => void;
  en?: boolean;
  watchedIds?: ReadonlySet<number>;
  signedIn?: boolean;
};

export default function TopMaterials({
  films,
  go,
  en = false,
  watchedIds,
  signedIn = false,
}: RankingProps) {
  const params = useSearchParams();
  // Existing bookmarked metric/limit URLs remain direct links to a ranking.
  const detail = params.has('metric') || params.has('limit');
  return detail ? (
    <RankedMaterials films={films} go={go} en={en} watchedIds={watchedIds} />
  ) : (
    <RankingLibrary
      films={films}
      go={go}
      en={en}
      watchedIds={watchedIds}
      signedIn={signedIn}
    />
  );
}

function RankingLibrary({
  films,
  go,
  en = false,
  watchedIds,
  signedIn = false,
}: RankingProps) {
  const params = useSearchParams(),
    router = useRouter();
  const { category } = parseMaterialTopOptions(params);
  const lists = useMemo(
    () => buildRankingLists(films, category, watchedIds),
    [films, category, watchedIds],
  );
  const navigate = (event: MouseEvent<HTMLAnchorElement>, url: string) => {
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
  const copy = {
    rating: {
      name: en ? 'Best rated' : 'Лучшие по оценкам',
      description: en
        ? 'Average ratings from our viewers'
        : 'По средним оценкам зрителей сайта',
      Icon: Star,
    },
    views: {
      name: en ? 'Most visited' : 'Самые популярные',
      description: en
        ? 'Title page visits, all time'
        : 'По посещениям страниц материалов за всё время',
      Icon: Eye,
    },
    favorites: {
      name: en ? 'Audience favorites' : 'Любимое зрителей',
      description: en
        ? 'Number of users who added a title to favorites'
        : 'По числу пользователей, добавивших в любимое',
      Icon: Heart,
    },
  };
  const number = (value: number) =>
    value.toLocaleString(en ? 'en-US' : 'ru-RU');
  return (
    <section
      className="material-top ranking-library"
      aria-label={en ? 'Best titles' : 'Лучшие материалы'}
    >
      <header className="ranking-library-hero">
        <div>
          <span className="eyebrow">
            {en ? 'YOUR NEXT GREAT DISCOVERY' : 'ТВОЁ СЛЕДУЮЩЕЕ КИНООТКРЫТИЕ'}
          </span>
          <h1>
            {en ? 'Worth your' : 'Достойны твоего'}{' '}
            <em>{en ? 'attention.' : 'внимания.'}</em>
          </h1>
          <p>
            {en
              ? 'Explore the lists. Find a story. Complete your own cinema journey.'
              : 'Исследуй списки. Находи свои истории. Собирай личную коллекцию кинооткрытий.'}
          </p>
        </div>
        <div className="ranking-library-seal" aria-hidden="true">
          <Sparkles size={20} />
          <span>
            CINEMA
            <br />
            LISTS
          </span>
          <small>MOVIEMOVIE</small>
        </div>
      </header>
      <div
        className="material-categories ranking-library-categories"
        role="group"
        aria-label={en ? 'Title category' : 'Категория материалов'}
      >
        {MATERIAL_CATEGORIES.map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={category === value}
            onClick={() =>
              router.push(rankingIndexUrl(value), { scroll: false })
            }
          >
            {en ? categoryNames[value] : value}
          </button>
        ))}
      </div>
      <div className="ranking-library-note">
        <span>
          <Trophy size={15} />
          {en
            ? '9 live lists · Top 10 / 50 / 100'
            : '9 живых списков · Топ 10 / 50 / 100'}
        </span>
        <p>
          {en
            ? 'Lists contain only eligible titles currently in our catalog, not external rankings.'
            : 'Только реальные материалы нашего каталога с оценками, посещениями или добавлениями в любимое. Это не внешние рейтинги.'}
        </p>
      </div>
      <div className="ranking-table-head" aria-hidden="true">
        <span>{en ? 'LIST' : 'СПИСОК'}</span>
        <span>{en ? 'YOUR PROGRESS' : 'ПРОСМОТРЕНО'}</span>
      </div>
      <div className="ranking-library-lists">
        {(['rating', 'views', 'favorites'] as const).map((metric) => {
          const { name, description, Icon } = copy[metric];
          return (
            <section
              className="ranking-list-group"
              key={metric}
              aria-label={name}
            >
              <h2>
                <Icon size={14} />
                {name}
                <span>{description}</span>
              </h2>
              <ul>
                {lists
                  .filter((list) => list.options.metric === metric)
                  .map((list) => {
                    const { options, total, watched, eligibleCount } = list;
                    const url = materialTopUrl(options),
                      percent = total ? Math.round((watched / total) * 100) : 0;
                    const title = en
                      ? `Top ${options.limit} · ${name.toLowerCase()}`
                      : `Топ-${options.limit} · ${name.toLowerCase()}`;
                    return (
                      <li key={options.limit}>
                        <a
                          className={`ranking-library-row ranking-tone-${metric}`}
                          href={url}
                          onClick={(event) => navigate(event, url)}
                        >
                          <span className="ranking-cover" aria-hidden="true">
                            <small>TOP</small>
                            <b>{options.limit}</b>
                            <Icon className="ranking-cover-icon" />
                            <span>MOVIEMOVIE</span>
                          </span>
                          <span className="ranking-list-info">
                            <strong>{title}</strong>
                            <span>
                              {en ? categoryNames[category] : category} <i>·</i>{' '}
                              {en
                                ? `${number(total)} titles`
                                : `Материалов: ${number(total)}`}
                            </span>
                            {total < options.limit && (
                              <small>
                                {total === 0
                                  ? en
                                    ? 'Be the first to start this list'
                                    : 'Список ждёт первых зрительских действий'
                                  : en
                                    ? 'Growing with the community'
                                    : 'Растёт вместе с сообществом'}
                              </small>
                            )}
                            {eligibleCount > options.limit && (
                              <small>
                                {en
                                  ? `Selected from ${number(eligibleCount)} titles`
                                  : `Отобрано из ${number(eligibleCount)} материалов`}
                              </small>
                            )}
                          </span>
                          <span
                            className="ranking-list-progress"
                            role="group"
                            aria-label={
                              signedIn
                                ? en
                                  ? `Watched ${watched} of ${total}`
                                  : `Просмотрено ${watched} из ${total}`
                                : en
                                  ? 'Sign in to track your progress'
                                  : 'Войди, чтобы отслеживать просмотры'
                            }
                          >
                            {signedIn ? (
                              <>
                                <span>
                                  <b>{number(watched)}</b> {en ? 'of' : 'из'}{' '}
                                  {number(total)}
                                </span>
                                <small>
                                  {total === 0
                                    ? en
                                      ? 'No titles yet'
                                      : 'Пока нет материалов'
                                    : watched === total
                                      ? en
                                        ? 'Completed'
                                        : 'Весь список просмотрен'
                                      : `${percent}%`}
                                </small>
                                <svg viewBox="0 0 36 36" aria-hidden="true">
                                  <circle cx="18" cy="18" r="14" />
                                  <circle
                                    cx="18"
                                    cy="18"
                                    r="14"
                                    pathLength="100"
                                    strokeDasharray={`${total ? (watched / total) * 100 : 0} 100`}
                                  />
                                </svg>
                              </>
                            ) : (
                              <>
                                <span>
                                  {en ? 'Your progress' : 'Твой прогресс'}
                                </span>
                                <small>
                                  {en
                                    ? 'Sign in to track'
                                    : 'Доступен после входа'}
                                </small>
                                <svg viewBox="0 0 36 36" aria-hidden="true">
                                  <circle cx="18" cy="18" r="14" />
                                </svg>
                              </>
                            )}
                          </span>
                          <ChevronRight
                            className="ranking-row-arrow"
                            size={17}
                            aria-hidden="true"
                          />
                        </a>
                      </li>
                    );
                  })}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="ranking-library-footnote">
        {en
          ? 'Your progress counts unique watched titles in each current list. Lists update as the community changes ratings, visits and favorites.'
          : 'Прогресс учитывает уникальные отмеченные просмотры в каждом текущем списке. Состав и прогресс могут меняться вместе с оценками, посещениями и любимым зрителей.'}
      </p>
    </section>
  );
}
