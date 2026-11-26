'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Dice5,
  Sparkles,
  Popcorn,
  MoonStar,
  Bookmark,
  Check,
  ChevronDown,
  RotateCcw,
  Shuffle,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { Film } from '@/lib/data';
import { materialTone } from '@/lib/trailers';
import { catalogTokens } from '@/lib/catalog-filter';
import {
  DEFAULT_ROULETTE_FILTERS,
  ROULETTE_MODES,
  ROULETTE_WINNER_INDEX,
  pickRoulette,
  roulettePool,
  rouletteStrip,
  type RouletteFilters,
  type RouletteMode,
} from '@/lib/roulette';
import { MediaRating } from './media-poster';
import MaterialCover from './material-cover';

const modes = {
  surprise: {
    icon: Dice5,
    ru: 'Удиви меня',
    en: 'Surprise me',
    sub: 'Вся киновселенная',
    subEn: 'The whole cinematic universe',
    title: 'Доверься случаю',
    titleEn: 'Let chance choose',
    note: 'Равные шансы для каждой истории из выборки.',
    noteEn: 'Every matching title has the same chance.',
  },
  unwatched: {
    icon: Sparkles,
    ru: 'Ещё не смотрел',
    en: 'Something new',
    sub: 'Радар открытий',
    subEn: 'Discovery radar',
    title: 'Открой неизведанное',
    titleEn: 'Explore the unknown',
    note: 'Без материалов, отмеченных тобой как просмотренные.',
    noteEn: 'Excludes titles you marked as watched.',
  },
  watchlist: {
    icon: Popcorn,
    ru: 'Из «Буду смотреть»',
    en: 'From my watchlist',
    sub: 'Твой счастливый билет',
    subEn: 'Your lucky ticket',
    title: 'Отложенное — на сегодня',
    titleEn: 'Saved for tonight',
    note: 'Выбираем только из твоего списка «Буду смотреть».',
    noteEn: 'Only titles from your Watch later list.',
  },
  evening: {
    icon: MoonStar,
    ru: 'На один вечер',
    en: 'One evening',
    sub: 'Ночной кинозал',
    subEn: 'After-hours cinema',
    title: 'Вечер для хорошего кино',
    titleEn: 'Make a night of it',
    note: 'Только полнометражное кино с известной длительностью в пределах лимита. Без сериалов.',
    noteEn:
      'Feature films with a known runtime within your limit. No series.',
  },
};
type Props = {
  films: Film[];
  watchedIds: ReadonlySet<number>;
  savedIds: ReadonlySet<number>;
  signedIn: boolean;
  en?: boolean;
  close: () => void;
  open: (id: number) => void;
  auth: () => void;
  bookmark: (id: number) => Promise<boolean>;
};
type Draw = {
  items: Film[];
  winner: Film;
  phase: 'spinning' | 'done';
  serial: number;
};

function SpinStage({
  pool,
  mode,
  getHistory,
  remember,
  savedIds,
  signedIn,
  en,
  open,
  auth,
  bookmark,
}: {
  pool: Film[];
  mode: RouletteMode;
  getHistory: () => number[];
  remember: (id: number) => void;
  savedIds: ReadonlySet<number>;
  signedIn: boolean;
  en: boolean;
  open: (id: number) => void;
  auth: () => void;
  bookmark: (id: number) => Promise<boolean>;
}) {
  const [draw, setDraw] = useState<Draw | null>(null),
    [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState(false);
  const result = useRef<HTMLHeadingElement>(null),
    spinLock = useRef(false);
  const spinning = draw?.phase === 'spinning';
  const finish = () => {
    spinLock.current = false;
    setDraw((current) => (current ? { ...current, phase: 'done' } : current));
  };
  useEffect(() => {
    if (!spinning) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => {
      if (media.matches) finish();
    };
    const timer = setTimeout(finish, 3300);
    media.addEventListener('change', changed);
    return () => {
      clearTimeout(timer);
      media.removeEventListener('change', changed);
    };
  }, [spinning, draw?.serial]);
  useEffect(() => {
    if (draw?.phase === 'done')
      result.current?.focus({ preventScroll: true });
  }, [draw?.phase, draw?.serial]);
  const spin = () => {
    if (spinLock.current) return;
    const previous = getHistory(),
      winner = pickRoulette(pool, previous);
    if (!winner) return;
    remember(winner.id);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    spinLock.current = !reduced;
    setSaveError(false);
    setDraw((current) => ({
      items: rouletteStrip(pool, winner),
      winner,
      phase: reduced ? 'done' : 'spinning',
      serial: (current?.serial || 0) + 1,
    }));
  };
  const theme = modes[mode],
    ModeIcon = theme.icon,
    winner = draw?.winner;
  return (
    <div className="rr-stage">
      <div
        className="rr-theatre"
        data-mode={mode}
        data-phase={draw?.phase || 'idle'}
      >
        <div className="rr-scenery" aria-hidden="true">
          <span>
            <ModeIcon size={74} />
          </span>
          <i />
          <i />
          <i />
        </div>
        {!draw ? (
          <div className="rr-invitation">
            <span>{en ? theme.subEn : theme.sub}</span>
            <b>
              {en ? 'What will you discover?' : 'Какая история ждёт тебя?'}
            </b>
            <small>
              {en
                ? 'Choose a mode. We will handle the choice.'
                : 'Выбирай настроение. Выбор истории — за нами.'}
            </small>
          </div>
        ) : (
          <>
            <div className="rr-window" aria-hidden="true">
              <div
                key={draw.serial}
                className="rr-strip"
                data-phase={draw.phase}
                onAnimationEnd={(event) => {
                  if (event.target === event.currentTarget) finish();
                }}
              >
                {draw.items.map((film, index) => (
                  <div
                    className={`rr-slot ${index === ROULETTE_WINNER_INDEX && !spinning ? 'is-winner' : ''}`}
                    key={index}
                  >
                    <MaterialCover
                      film={film}
                      preview={false}
                      badges={false}
                    />
                  </div>
                ))}
              </div>
              <div className="rr-selector">
                <ChevronDown size={22} />
              </div>
            </div>
            {spinning && (
              <button type="button" className="rr-skip" onClick={finish}>
                {en ? 'Skip animation' : 'Пропустить анимацию'}
                <ArrowRight size={14} />
              </button>
            )}
          </>
        )}
      </div>
      <div className="rr-status" role="status" aria-live="polite">
        {spinning
          ? en
            ? 'Choosing your next story…'
            : 'Выбираем твою следующую историю…'
          : en
            ? `${pool.length} matching titles · equal chances`
            : `В розыгрыше: ${pool.length} · равные шансы`}
      </div>
      {winner && !spinning ? (
        <article
          className="rr-result"
          data-winner-id={winner.id}
          style={
            {
              '--rr-result-image':
                winner.backdrop || winner.poster
                  ? `url(${JSON.stringify(winner.backdrop || winner.poster)})`
                  : 'none',
            } as CSSProperties
          }
        >
          <MaterialCover
            film={winner}
            alt={winner.title}
            className="rr-result-poster"
          />
          <div className="rr-result-copy">
            <span className="rr-kicker">
              <ModeIcon size={12} /> {en ? theme.en : theme.ru}
            </span>
            <h3 ref={result} tabIndex={-1}>
              {winner.title}
            </h3>
            <div className="rr-meta">
              <span className="rr-rating" data-tone={materialTone(winner)}>
                <MediaRating film={winner} />
              </span>
              <span>{winner.year}</span>
              <span>{winner.category}</span>
              {winner.duration > 0 && (
                <span>
                  {winner.duration} {en ? 'min' : 'мин'}
                  {!['Фильм', 'Мультфильм', 'Аниме-фильм'].includes(
                    winner.category,
                  )
                    ? en
                      ? ' / ep.'
                      : ' / серия'
                    : ''}
                </span>
              )}
            </div>
            <p>{winner.genre}</p>
            <div className="rr-result-actions">
              <button
                type="button"
                className="primary-btn"
                onClick={() => open(winner.id)}
              >
                {en ? 'Open material' : 'Открыть материал'}
                <ArrowRight size={15} />
              </button>
              <button
                type="button"
                className="outline-btn"
                disabled={saving || savedIds.has(winner.id)}
                onClick={async () => {
                  if (!signedIn) {
                    auth();
                    return;
                  }
                  setSaving(true);
                  setSaveError(false);
                  try {
                    const ok = await bookmark(winner.id);
                    setSaveError(!ok);
                  } catch {
                    setSaveError(true);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {savedIds.has(winner.id) ? (
                  <Check size={15} />
                ) : (
                  <Bookmark size={15} />
                )}
                {saving
                  ? en
                    ? 'Saving…'
                    : 'Сохраняем…'
                  : savedIds.has(winner.id)
                    ? en
                      ? 'Saved'
                      : 'В списке'
                    : en
                      ? 'Watch later'
                      : 'Буду смотреть'}
              </button>
            </div>
            {saveError && (
              <p role="alert">
                {en
                  ? 'Could not save. Try again.'
                  : 'Не удалось сохранить. Попробуй ещё раз.'}
              </p>
            )}
          </div>
        </article>
      ) : null}
      <button
        type="button"
        className="primary-btn rr-spin"
        disabled={!pool.length || spinning || saving}
        onClick={spin}
      >
        {draw && !spinning ? <RotateCcw size={18} /> : <Shuffle size={18} />}
        {spinning
          ? en
            ? 'Choosing…'
            : 'Выбираем…'
          : draw
            ? en
              ? 'Another story'
              : 'Другой вариант'
            : en
              ? 'Spin the roulette'
              : 'Крутить рулетку'}
      </button>
    </div>
  );
}

export default function CinemaRoulette({
  films,
  watchedIds,
  savedIds,
  signedIn,
  en = false,
  close,
  open,
  auth,
  bookmark,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null),
    id = useId(),
    history = useRef<Partial<Record<RouletteMode, number[]>>>({});
  const [mode, setMode] = useState<RouletteMode>('surprise'),
    [filters, setFilters] = useState<RouletteFilters>({
      ...DEFAULT_ROULETTE_FILTERS,
    });
  useEffect(() => {
    const node = dialog.current,
      previous = document.activeElement,
      overflow = document.body.style.overflow;
    node?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      node?.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, []);
  const pool = useMemo(
    () => roulettePool(films, mode, filters, watchedIds, savedIds, signedIn),
    [films, mode, filters, watchedIds, savedIds, signedIn],
  );
  const genres = useMemo(
    () => [...new Set(films.flatMap((f) => catalogTokens(f.genre)))].sort(),
    [films],
  );
  const categories = useMemo(
    () => [...new Set(films.map((f) => f.category))].sort(),
    [films],
  );
  const personal =
      !signedIn && (mode === 'unwatched' || mode === 'watchlist'),
    theme = modes[mode];
  const update = <K extends keyof RouletteFilters>(
    key: K,
    value: RouletteFilters[K],
  ) => setFilters((current) => ({ ...current, [key]: value }));
  // A catalog/user/filter change invalidates the draw and cleans up its animation timer.
  const stageKey = JSON.stringify([
    mode,
    filters,
    pool.map((f) => [f.id, f.poster, f.title, f.rating]),
    signedIn,
  ]);
  return createPortal(
    <dialog
      ref={dialog}
      className="cinema-roulette"
      data-mode={mode}
      aria-labelledby={id}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], select:not(:disabled), input:not(:disabled), summary, [tabindex="0"]',
          ),
        ].filter(
          (node) =>
            node.getClientRects().length > 0 &&
            getComputedStyle(node).visibility !== 'hidden',
        );
        const first = controls[0],
          last = controls.at(-1),
          active = document.activeElement;
        if (!first || !last) {
          event.preventDefault();
          return;
        }
        if (
          !controls.includes(active as HTMLElement) ||
          (event.shiftKey ? active === first : active === last)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const r = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            close();
        }
      }}
    >
      <header className="rr-header">
        <span className="rr-kicker">
          MOVIEMOVIE / {en ? 'CINEMA CHANCE' : 'КИНОСЛУЧАЙ'}
        </span>
        <button
          type="button"
          className="rr-close"
          aria-label={en ? 'Close roulette' : 'Закрыть рулетку'}
          onClick={close}
        >
          <X size={20} />
        </button>
        <h2 id={id}>{en ? theme.titleEn : theme.title}</h2>
        <p>{en ? theme.noteEn : theme.note}</p>
      </header>
      <div
        className="rr-modes"
        role="group"
        aria-label={en ? 'Roulette mode' : 'Режим рулетки'}
      >
        {ROULETTE_MODES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            data-mode={value}
            onClick={() => setMode(value)}
          >
            <span aria-hidden="true">
              {(() => {
                const Icon = modes[value].icon;
                return <Icon size={23} />;
              })()}
            </span>
            <b>{en ? modes[value].en : modes[value].ru}</b>
            <small>{en ? modes[value].subEn : modes[value].sub}</small>
          </button>
        ))}
      </div>
      <details className="rr-filters">
        <summary>
          <SlidersHorizontal size={14} />
          {en ? 'Fine-tune your choice' : 'Настроить выбор'}
          {(filters.category !== 'all' ||
            filters.genre !== 'all' ||
            filters.minRating > 0) &&
            ' •'}
        </summary>
        <div className="rr-filter-grid">
          <label>
            {en ? 'Format' : 'Формат'}
            <select
              aria-label={en ? 'Format' : 'Формат'}
              value={filters.category}
              onChange={(e) => update('category', e.target.value)}
            >
              <option value="all">
                {en ? 'All formats' : 'Все форматы'}
              </option>
              {categories.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            {en ? 'Genre' : 'Жанр'}
            <select
              aria-label={en ? 'Genre' : 'Жанр'}
              value={filters.genre}
              onChange={(e) => update('genre', e.target.value)}
            >
              <option value="all">{en ? 'All genres' : 'Все жанры'}</option>
              {genres.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            {en ? 'Minimum rating' : 'Рейтинг от'}
            <select
              aria-label={en ? 'Minimum rating' : 'Рейтинг от'}
              value={filters.minRating}
              onChange={(e) => update('minRating', Number(e.target.value))}
            >
              <option value={0}>
                {en ? 'Any / unrated' : 'Любой / без оценки'}
              </option>
              {[7, 8, 9].map((value) => (
                <option key={value} value={value}>
                  {value}+
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="outline-btn"
            onClick={() => setFilters({ ...DEFAULT_ROULETTE_FILTERS })}
          >
            {en ? 'Reset filters' : 'Сбросить фильтры'}
          </button>
        </div>
      </details>
      {mode === 'evening' && (
        <label className="rr-runtime">
          {en ? 'Time for a film' : 'Время на фильм'}
          <select
            aria-label={en ? 'Time for a film' : 'Время на фильм'}
            value={filters.maxMinutes}
            onChange={(e) => update('maxMinutes', Number(e.target.value))}
          >
            {[90, 120, 150, 180].map((value) => (
              <option key={value} value={value}>
                {en ? 'Up to' : 'До'} {value} {en ? 'min' : 'мин'}
              </option>
            ))}
          </select>
        </label>
      )}
      {personal ? (
        <div className="rr-empty" role="status">
          <b>{en ? 'Your personal cinema' : 'Твоя личная подборка'}</b>
          <p>
            {en
              ? 'Sign in to use your watched titles and watchlist.'
              : 'Войди, чтобы использовать свои просмотры и список «Буду смотреть».'}
          </p>
          <button type="button" className="primary-btn" onClick={auth}>
            {en ? 'Sign in' : 'Войти'}
          </button>
        </div>
      ) : !pool.length ? (
        <div className="rr-empty" role="status">
          <b>
            {en ? 'No matching stories yet' : 'Пока нет подходящих историй'}
          </b>
          <p>
            {mode === 'watchlist'
              ? en
                ? 'Add titles to Watch later or relax your filters.'
                : 'Добавь материалы в «Буду смотреть» или ослабь фильтры.'
              : mode === 'unwatched'
                ? en
                  ? 'Everything matching is watched. Change the filters or mode.'
                  : 'Всё подходящее уже просмотрено. Измени фильтры или режим.'
                : mode === 'evening'
                  ? en
                    ? 'Try more time or different filters. Unknown runtimes and series are excluded.'
                    : 'Увеличь время или измени фильтры. Сериалы и материалы без длительности не участвуют.'
                  : en
                    ? 'Change your filters or add materials to the catalog.'
                    : 'Измени фильтры или добавь материалы в каталог.'}
          </p>
          <button
            type="button"
            className="outline-btn"
            onClick={() => setFilters({ ...DEFAULT_ROULETTE_FILTERS })}
          >
            {en ? 'Reset filters' : 'Сбросить фильтры'}
          </button>
        </div>
      ) : (
        <SpinStage
          key={stageKey}
          pool={pool}
          mode={mode}
          getHistory={() => history.current[mode] || []}
          remember={(id) => {
            history.current = {
              ...history.current,
              [mode]: [
                ...(history.current[mode] || []).filter((id) =>
                  pool.some((film) => film.id === id),
                ),
                id,
              ].slice(-Math.max(pool.length, 1)),
            };
          }}
          savedIds={savedIds}
          signedIn={signedIn}
          en={en}
          open={open}
          auth={auth}
          bookmark={bookmark}
        />
      )}
      <footer className="rr-footnote">
        {en
          ? 'No immediate repeats when alternatives exist. No autoplay or sound.'
          : 'Без повторов подряд, если есть выбор. Без автовоспроизведения и звука.'}
      </footer>
    </dialog>,
    document.body,
  );
}
