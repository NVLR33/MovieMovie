'use client';
import MaterialCover from './material-cover';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpRight,
  CalendarDays,
  GripVertical,
  List,
  Orbit,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { browserStorage } from '@/lib/browser-preferences';
import {
  buildMemories,
  filterMemories,
  memoryDepth,
  memoryMonthLabel,
  type MemoryEntry,
  type MemoryFilm,
  type MemoryWatch,
  type MemoryRating,
  type MemoryReview,
} from '@/lib/memory-orbit';
const PAGE = 24,
  MODE_KEY = 'mg_memory_view';
function useSpatialScroll(
  ref: { current: HTMLElement | null },
  version: string,
  enabled: boolean,
) {
  useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)'),
      data = matchMedia('(prefers-reduced-data: reduce)');
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    let observer: IntersectionObserver | undefined,
      frame = 0;
    const slots = [...root.querySelectorAll<HTMLElement>('.orbit-slot')],
      active = new Set<HTMLElement>();
    const paint = () => {
      frame = 0;
      for (const slot of active) {
        const box = slot.getBoundingClientRect(),
          depth = memoryDepth(
            box.top + box.height / 2,
            innerHeight,
            innerWidth <= 760,
          );
        slot.style.setProperty('--orbit-z', `${depth.z.toFixed(1)}px`);
        slot.style.setProperty('--orbit-tilt', `${depth.tilt.toFixed(2)}deg`);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const stop = () => {
      observer?.disconnect();
      observer = undefined;
      active.clear();
      cancelAnimationFrame(frame);
      frame = 0;
      for (const slot of slots) {
        slot.style.removeProperty('--orbit-z');
        slot.style.removeProperty('--orbit-tilt');
      }
      delete root.dataset.spatial;
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
    const start = () => {
      stop();
      if (
        motion.matches ||
        data.matches ||
        connection?.saveData ||
        typeof IntersectionObserver === 'undefined'
      )
        return;
      root.dataset.spatial = 'on';
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const slot = entry.target as HTMLElement;
            if (entry.isIntersecting) active.add(slot);
            else active.delete(slot);
          }
          schedule();
        },
        { rootMargin: '100px' },
      );
      for (const slot of slots) observer.observe(slot);
      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule, { passive: true });
    };
    start();
    motion.addEventListener('change', start);
    data.addEventListener('change', start);
    return () => {
      stop();
      motion.removeEventListener('change', start);
      data.removeEventListener('change', start);
    };
  }, [ref, version, enabled]);
}
function MemoryDialog({
  entry,
  close,
  go,
  trigger,
}: {
  entry: MemoryEntry;
  close: () => void;
  go: (path: string) => void;
  trigger: HTMLElement | null;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    title = useId();
  const [revealed, setRevealed] = useState(false);
  useLayoutEffect(() => {
    const dialog = ref.current!,
      overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      const restore = (attempt = 0) => {
        if (
          !trigger?.isConnected ||
          document.querySelector('dialog[open],.modal-backdrop,[role=dialog]')
        )
          return;
        const active = document.activeElement;
        if (
          active &&
          active !== document.body &&
          active !== trigger &&
          !dialog.contains(active)
        )
          return;
        if (getComputedStyle(trigger).visibility === 'visible')
          trigger.focus({ preventScroll: true });
        if (document.activeElement !== trigger && attempt < 8)
          requestAnimationFrame(() => restore(attempt + 1));
      };
      setTimeout(() => requestAnimationFrame(() => restore()));
    };
  }, [trigger]);
  return createPortal(
    <dialog
      ref={ref}
      className="orbit-memory"
      aria-labelledby={title}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], [tabindex="0"]',
          ),
        ].filter((node) => node.getClientRects().length);
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const b = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < b.left ||
          e.clientX > b.right ||
          e.clientY < b.top ||
          e.clientY > b.bottom
        )
          close();
      }}
    >
      <header>
        <span className="eyebrow">ВОСПОМИНАНИЕ / КИНОДНЕВНИК</span>
        <button
          type="button"
          className="orbit-close"
          aria-label="Закрыть воспоминание"
          onClick={close}
          autoFocus
        >
          <X size={20} />
        </button>
      </header>
      <div className="orbit-memory-identity">
        <MaterialCover
          film={entry.film}
          badges={false}
          preview={false}
          className="memory-dialog-cover"
        />
        <div>
          <h2 id={title}>{entry.film.title}</h2>
          <p>
            {entry.film.year} · {entry.film.category}
          </p>
          <span className="orbit-memory-rating">
            <Star size={16} />
            {entry.rating === null ? 'Без оценки' : `${entry.rating} / 10`}
          </span>
          {entry.kind === 'classic' && (
            <b className="orbit-classic-label">Личная классика</b>
          )}
        </div>
      </div>
      <p className="orbit-memory-date">
        <CalendarDays size={15} />
        {entry.dateLabel} · UTC
      </p>
      <p className="orbit-memory-note">
        Дата отметки просмотра; оценка и отзыв показаны в их текущем виде. Это
        не архив изменений и не повторный сеанс.
      </p>
      <section className="orbit-own-review" aria-label="Твой отзыв">
        <h3>Твой отзыв</h3>
        {entry.review ? (
          entry.review.spoiler && !revealed ? (
            <button
              type="button"
              className="outline-btn"
              onClick={() => setRevealed(true)}
            >
              Показать мой отзыв со спойлером
            </button>
          ) : (
            <>
              <p>{entry.review.body}</p>
              {entry.review.spoiler && (
                <button
                  type="button"
                  className="orbit-text-button"
                  onClick={() => setRevealed(false)}
                >
                  Скрыть спойлер
                </button>
              )}
            </>
          )
        ) : (
          <p>
            Собственный отзыв пока не найден. Его можно написать на странице
            материала.
          </p>
        )}
      </section>
      <a
        className="primary-btn orbit-open-film"
        href={`/movie/${entry.film.id}`}
        onClick={(e) => {
          if (
            e.metaKey ||
            e.ctrlKey ||
            e.altKey ||
            e.shiftKey ||
            e.button !== 0
          )
            return;
          e.preventDefault();
          close();
          go(`/movie/${entry.film.id}`);
        }}
      >
        Открыть материал <ArrowUpRight size={16} />
      </a>
    </dialog>,
    document.body,
  );
}
export default function MemoryOrbit({
  films,
  watches,
  ratings,
  comments,
  userId,
  editing = false,
  go,
}: {
  films: readonly MemoryFilm[];
  watches: readonly MemoryWatch[];
  ratings: readonly MemoryRating[];
  comments: readonly MemoryReview[];
  userId: number;
  editing?: boolean;
  go: (path: string) => void;
}) {
  const entries = useMemo(
    () => buildMemories(films, watches, ratings, comments, userId),
    [films, watches, ratings, comments, userId],
  );
  const [mode, setMode] = useState<'orbit' | 'list'>('orbit'),
    [month, setMonth] = useState(''),
    [classics, setClassics] = useState(false),
    [limit, setLimit] = useState(PAGE),
    [selected, setSelected] = useState<{
      id: number;
      trigger: HTMLElement;
    } | null>(null);
  const root = useRef<HTMLElement>(null),
    heading = useId();
  useEffect(() => {
    const stored = browserStorage.getItem(MODE_KEY);
    const frame =
      stored === 'list' ? requestAnimationFrame(() => setMode('list')) : 0;
    return () => cancelAnimationFrame(frame);
  }, []);
  const filtered = useMemo(
      () => filterMemories(entries, month, classics),
      [entries, month, classics],
    ),
    visible = filtered.slice(0, limit);
  const months = [...new Set(entries.map((entry) => entry.month))];
  const groups = visible.reduce<{ key: string; entries: MemoryEntry[] }[]>(
    (all, entry) => {
      const last = all[all.length - 1];
      if (last?.key === entry.month) last.entries.push(entry);
      else all.push({ key: entry.month, entries: [entry] });
      return all;
    },
    [],
  );
  const current = entries.find((entry) => entry.film.id === selected?.id);
  useSpatialScroll(
    root,
    `${mode}:${month}:${classics}:${visible.map((entry) => entry.film.id).join(',')}`,
    mode === 'orbit' && !editing,
  );
  const changeMode = (next: 'orbit' | 'list') => {
    setMode(next);
    browserStorage.setItem(MODE_KEY, next);
  };
  return (
    <section
      ref={root}
      className={`memory-orbit orbit-mode-${mode}`}
      aria-labelledby={heading}
      data-editing={editing || undefined}
    >
      <div className="orbit-heading">
        <div>
          <span className="eyebrow">ТВОЁ СОЗВЕЗДИЕ ИСТОРИЙ</span>
          <h3 id={heading}>
            <Orbit size={21} />
            Орбита воспоминаний
          </h3>
          <p>История просмотров — путешествие по твоему кино.</p>
        </div>
        {editing && <GripVertical size={18} aria-hidden="true" />}
        <span className="orbit-entry-count">{entries.length} в дневнике</span>
      </div>
      <div className="orbit-toolbar">
        <div
          className="orbit-view-switch"
          role="group"
          aria-label="Вид истории просмотров"
        >
          <button
            type="button"
            aria-pressed={mode === 'orbit'}
            onClick={() => changeMode('orbit')}
          >
            <Orbit size={15} />
            Лента
          </button>
          <button
            type="button"
            aria-pressed={mode === 'list'}
            onClick={() => changeMode('list')}
          >
            <List size={15} />
            Список
          </button>
        </div>
        <label className="orbit-month">
          <CalendarDays size={14} />
          <select
            aria-label="Месяц просмотра"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setLimit(PAGE);
            }}
          >
            <option value="">Все месяцы</option>
            {months.map((key) => (
              <option key={key} value={key}>
                {memoryMonthLabel(key)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="orbit-classics-filter"
          aria-pressed={classics}
          onClick={() => {
            setClassics((v) => !v);
            setLimit(PAGE);
          }}
        >
          <Sparkles size={15} />
          Личная классика <small>10/10</small>
        </button>
      </div>
      <p className="orbit-legend">
        <span>
          <Star size={12} />
          10/10 — яркие личные открытия
        </span>
        <span>0.5–4 — не совпало с твоим вкусом</span>
        <span>Без оценки — нейтральная карточка</span>
      </p>
      {visible.length ? (
        <div className="orbit-scene">
          {groups.map((group) => (
            <section
              className="orbit-month-group"
              key={group.key}
              aria-label={memoryMonthLabel(group.key)}
            >
              <h4>
                <span />
                {memoryMonthLabel(group.key)}
              </h4>
              <ol className="orbit-strip">
                {group.entries.map((entry) => (
                  <li
                    className={`orbit-slot memory-${entry.kind}`}
                    key={entry.film.id}
                  >
                    <button
                      type="button"
                      className="orbit-card"
                      aria-label={`Воспоминание: ${entry.film.title}. ${entry.dateLabel}. ${entry.rating === null ? 'Без оценки' : `${entry.rating} из 10`}`}
                      onClick={(e) => {
                        setSelected({
                          id: entry.film.id,
                          trigger: e.currentTarget,
                        });
                      }}
                    >
                      <MaterialCover
                        film={entry.film}
                        badges={false}
                        preview={false}
                        className="orbit-poster"
                      >
                        <span className="orbit-score">
                          <Star size={12} />
                          {entry.rating === null ? '—' : entry.rating + '/10'}
                        </span>
                        {entry.kind === 'classic' && (
                          <span className="orbit-classic-label">
                            <Sparkles size={11} />
                            Личная классика
                          </span>
                        )}
                      </MaterialCover>
                      <span className="orbit-caption">
                        <b>{entry.film.title}</b>
                        <small>{entry.dateLabel}</small>
                        <span>
                          {entry.film.year} · {entry.film.category}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <div className="orbit-empty">
          <Orbit size={34} />
          <h4>
            {entries.length
              ? 'На этой орбите пока тихо'
              : 'Первая история ещё впереди'}
          </h4>
          <p>
            {entries.length
              ? 'Для выбранного месяца и фильтра нет просмотров.'
              : 'Отметь просмотренное кино — здесь появятся твои воспоминания.'}
          </p>
          {entries.length ? (
            <button
              type="button"
              className="outline-btn"
              onClick={() => {
                setMonth('');
                setClassics(false);
                setLimit(PAGE);
              }}
            >
              Сбросить фильтры истории
            </button>
          ) : (
            <button
              type="button"
              className="outline-btn"
              onClick={() => go('/catalog')}
            >
              Выбрать историю в каталоге
            </button>
          )}
        </div>
      )}
      <footer className="orbit-footer">
        <span role="status">
          Показано {visible.length} из {filtered.length}
        </span>
        {limit < filtered.length && (
          <button
            type="button"
            className="outline-btn"
            onClick={() => setLimit((v) => v + PAGE)}
          >
            Ещё {Math.min(PAGE, filtered.length - limit)} воспоминаний
          </button>
        )}
        <small>
          Даты по UTC · повторные сеансы не выдумываем · прокрутка без
          перехвата
        </small>
      </footer>
      {current && (
        <MemoryDialog
          key={current.film.id}
          entry={current}
          trigger={selected?.trigger ?? null}
          close={() => setSelected(null)}
          go={go}
        />
      )}
    </section>
  );
}
