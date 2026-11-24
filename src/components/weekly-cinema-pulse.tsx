'use client';

import MediaPoster from './media-poster';
import { TrailerSurface } from './trailer-preview';
import { materialTone } from '@/lib/trailers';
import { useMemo, useState, type MouseEvent } from 'react';
import {
  Activity,
  ArrowUpRight,
  Bookmark,
  Check,
  Eye,
  Film as FilmIcon,
  Star,
  Users,
} from 'lucide-react';
import type { Film } from '@/lib/data';
import type { WeeklyPulse } from '@/lib/weekly-pulse';
import { formatFilmRating } from '@/lib/rating-display';
type Action = (
  payload: Record<string, unknown>,
  success?: string,
) => Promise<boolean>;

function PulseCard({
  film,
  place,
  viewers,
  lead,
  saved,
  watched,
  signedIn,
  action,
  auth,
  go,
  en,
}: {
  film: Film;
  place: number;
  viewers: number;
  lead: boolean;
  saved: boolean;
  watched: boolean;
  signedIn: boolean;
  action: Action;
  auth: () => void;
  go: (url: string) => void;
  en: boolean;
}) {
  const [busy, setBusy] = useState<'bookmark' | 'watch' | null>(null);
  const viewerLabel = en
    ? viewers === 1
      ? 'viewer'
      : 'viewers'
    : viewers % 10 === 1 && viewers % 100 !== 11
      ? 'зритель'
      : viewers % 10 >= 2 &&
          viewers % 10 <= 4 &&
          (viewers % 100 < 12 || viewers % 100 > 14)
        ? 'зрителя'
        : 'зрителей';
  const number = (value: number) =>
    value.toLocaleString(en ? 'en-US' : 'ru-RU');
  const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey
    )
      return;
    event.preventDefault();
    go(`/movie/${film.id}`);
  };
  const change = async (kind: 'bookmark' | 'watch') => {
    if (!signedIn) {
      auth();
      return;
    }
    if (busy || (kind === 'watch' && watched)) return;
    setBusy(kind);
    try {
      await action(
        { action: kind, movieId: film.id },
        kind === 'watch'
          ? en
            ? 'Marked as watched'
            : 'Отмечено как просмотренное'
          : undefined,
      );
    } finally {
      setBusy(null);
    }
  };
  return (
    <article
      className={`weekly-pulse-card ${lead ? 'weekly-pulse-lead' : 'weekly-pulse-small'} tone-${materialTone(film)}`}
      aria-label={`${en ? 'Place' : 'Место'} ${place}: ${film.title}`}
    >
      <div className="weekly-pulse-poster">
        <a
          href={`/movie/${film.id}`}
          onClick={navigate}
          aria-label={`${en ? 'Open' : 'Открыть'} ${film.title}`}
        >
          <TrailerSurface
            trailerUrl={film.trailerUrl}
            className="weekly-trailer-surface"
          >
            <MediaPoster src={film.poster} alt="" />
          </TrailerSurface>
        </a>
        <span
          className="weekly-pulse-place"
          aria-label={`${en ? 'Place' : 'Место'} ${place}`}
        >
          #{place}
        </span>
        <button
          type="button"
          className="weekly-pulse-save"
          aria-label={`${en ? 'Watch later' : 'Смотреть позже'}: ${film.title}`}
          aria-pressed={saved}
          disabled={busy !== null}
          onClick={() => void change('bookmark')}
          title={en ? 'Watch later' : 'Смотреть позже'}
        >
          {saved ? <Check size={16} /> : <Bookmark size={16} />}
        </button>
        {film.ageRating && (
          <small className="weekly-pulse-age">{film.ageRating}</small>
        )}
      </div>
      <div className="weekly-pulse-info">
        <a
          className="weekly-pulse-title"
          href={`/movie/${film.id}`}
          onClick={navigate}
        >
          <h3>{film.title}</h3>
        </a>
        {lead && (
          <p className="weekly-pulse-meta">
            {film.year} · {film.category}
            <br />
            {film.duration > 0
              ? `${film.duration} ${en ? 'min' : 'мин'}${film.episodes ? ` · ${film.episodes} ${en ? 'eps' : 'эп.'}` : ''}`
              : film.genre}
          </p>
        )}
        <span className="weekly-pulse-rating">
          <Star size={12} />
          {formatFilmRating(film)}
          {lead && film.ratingCount > 0 && (
            <small>
              {number(film.ratingCount)} {en ? 'votes' : 'оценок'}
            </small>
          )}
        </span>
        <span className="weekly-pulse-viewers">
          <Users size={12} />
          <b>{number(viewers)}</b>
          <small>
            {viewerLabel} / {en ? '7 days' : '7 дней'}
          </small>
        </span>
        {lead && (
          <>
            <button
              type="button"
              className="weekly-pulse-watch"
              aria-label={`${watched ? (en ? 'Watched' : 'Просмотрено') : en ? 'Mark watched' : 'Отметить просмотр'}: ${film.title}`}
              disabled={watched || busy !== null}
              onClick={() => void change('watch')}
            >
              {watched ? <Check size={14} /> : <Eye size={14} />}
              <span>
                {watched
                  ? en
                    ? 'Watched'
                    : 'Просмотрено'
                  : en
                    ? 'Mark watched'
                    : 'Отметить просмотр'}
              </span>
            </button>
            <a
              className="weekly-pulse-rate"
              href={`/movie/${film.id}`}
              onClick={navigate}
            >
              {en ? 'Open and rate' : 'Открыть и оценить'}
              <ArrowUpRight size={13} />
            </a>
          </>
        )}
      </div>
      {lead && (
        <p className="weekly-pulse-description">
          {film.description ||
            (en
              ? 'A new story is waiting for your discovery.'
              : 'Ещё одна история, которую стоит открыть для себя.')}
        </p>
      )}
    </article>
  );
}
export default function WeeklyCinemaPulse({
  films,
  pulse,
  watches,
  bookmarks,
  signedIn,
  action,
  auth,
  go,
  en = false,
}: {
  films: Film[];
  pulse: WeeklyPulse | null;
  watches: readonly { movieId: number }[];
  bookmarks: readonly { movieId: number }[];
  signedIn: boolean;
  action: Action;
  auth: () => void;
  go: (url: string) => void;
  en?: boolean;
}) {
  const watched = useMemo(
      () => new Set(watches.map((watch) => watch.movieId)),
      [watches],
    ),
    saved = useMemo(
      () => new Set(bookmarks.map((bookmark) => bookmark.movieId)),
      [bookmarks],
    );
  const entries = useMemo(() => {
    const index = new Map(films.map((film) => [film.id, film]));
    return (pulse?.entries || [])
      .flatMap((entry) => {
        const film = index.get(entry.movieId);
        return film ? [{ ...entry, film }] : [];
      })
      .slice(0, 10);
  }, [films, pulse]);
  const locale = en ? 'en-US' : 'ru-RU';
  const period =
    pulse &&
    Number.isFinite(Date.parse(pulse.since)) &&
    Number.isFinite(Date.parse(pulse.until))
      ? `${new Date(pulse.since).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })} — ${new Date(pulse.until).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })} · UTC`
      : '';
  const card = (
    entry: (typeof entries)[number],
    index: number,
    lead: boolean,
  ) => (
    <li key={entry.movieId}>
      <PulseCard
        film={entry.film}
        place={index + 1}
        viewers={entry.viewers}
        lead={lead}
        saved={saved.has(entry.movieId)}
        watched={watched.has(entry.movieId)}
        signedIn={signedIn}
        action={action}
        auth={auth}
        go={go}
        en={en}
      />
    </li>
  );
  return (
    <section
      className="home-section weekly-cinema-pulse"
      aria-label={en ? 'Weekly cinema pulse' : 'Кинопульс недели'}
    >
      <header className="weekly-pulse-heading">
        <div>
          <span className="eyebrow">
            <Activity size={14} />
            {en ? 'CINEMA PULSE' : 'КИНОПУЛЬС'}
          </span>
          <h2>
            {en ? 'This week' : 'На этой неделе'}
            <span>
              {entries.length
                ? `${en ? 'TOP' : 'ТОП'} ${entries.length}`
                : en
                  ? '7 DAYS'
                  : '7 ДНЕЙ'}
            </span>
          </h2>
        </div>
        <span className="weekly-pulse-period">{period}</span>
      </header>
      <p className="weekly-pulse-method">
        {en
          ? 'Most viewers marked these titles watched in the last 7 days. Ties: overall user rating, votes, then title ID.'
          : 'Чаще отмечали просмотренным за последние 7 дней. Места — по числу зрителей; при равенстве — общий рейтинг, число оценок и ID материала.'}
      </p>
      {entries.length ? (
        <>
          <ol
            className="weekly-pulse-podium"
            aria-label={en ? 'Weekly leaders' : 'Лидеры недели'}
          >
            {entries
              .slice(0, 3)
              .map((entry, index) => card(entry, index, true))}
          </ol>
          {entries.length > 3 && (
            <ol
              className="weekly-pulse-rest"
              start={4}
              tabIndex={0}
              aria-label={
                en
                  ? 'More weekly discoveries; scroll horizontally'
                  : 'Остальные открытия недели; доступна горизонтальная прокрутка'
              }
            >
              {entries
                .slice(3)
                .map((entry, index) => card(entry, index + 3, false))}
            </ol>
          )}
          <p className="weekly-pulse-footnote">
            {en
              ? 'Current watch marks, not streaming statistics or page visits. Each viewer counts once per title.'
              : 'Текущие отметки просмотра, не статистика онлайн-кинотеатров и не посещения страниц. Один зритель учитывается один раз на материал.'}
          </p>
        </>
      ) : (
        <div className="weekly-pulse-empty">
          <Activity size={30} />
          <h3>
            {!pulse
              ? en
                ? 'Preparing the cinema pulse'
                : 'Готовим Кинопульс'
              : en
                ? 'The week is just getting started'
                : 'Неделя только набирает обороты'}
          </h3>
          <p>
            {!pulse
              ? en
                ? 'Weekly data has not arrived yet. Please try refreshing in a moment.'
                : 'Недельные данные пока не получены. Если блок не обновится, перезагрузи страницу чуть позже.'
              : en
                ? 'No watch marks in the last 7 days yet. Real discoveries will appear here.'
                : 'За последние 7 дней ещё нет отметок просмотра. Здесь появятся настоящие открытия зрителей.'}
          </p>
          <button
            type="button"
            className="outline-btn"
            onClick={() => go('/catalog')}
          >
            {en ? 'Explore catalog' : 'Открыть каталог'}
          </button>
        </div>
      )}
    </section>
  );
}
