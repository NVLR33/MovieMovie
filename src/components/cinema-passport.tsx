'use client';
import MaterialCover from './material-cover';
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import {
  ArrowUpRight,
  Check,
  Compass,
  Flame,
  Globe2,
  PieChart,
  Stamp,
  Ticket,
} from 'lucide-react';
import {
  passportStats,
  type PassportFilm,
  type PassportWatch,
} from '@/lib/cinema-passport';
import { countryName, parseFilmCountries } from '@/lib/cinema-countries';
const PassportGlobe = lazy(() => import('./passport-globe'));
const COLORS = [
  'var(--accent)',
  '#f08db7',
  '#70c9bb',
  '#e3b97b',
  '#899feb',
  'var(--subtle)',
];
function usePassportClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const time = Date.now();
      setNow(time);
      clearTimeout(timer);
      timer = setTimeout(update, 86_400_000 - (time % 86_400_000) + 50);
    };
    const visible = () => {
      if (document.visibilityState === 'visible') update();
    };
    update();
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  return now;
}
export default function CinemaPassport({
  films,
  watches,
  go,
  onTitles,
}: {
  films: readonly PassportFilm[];
  watches: readonly PassportWatch[];
  go: (path: string) => void;
  onTitles: () => void;
}) {
  const now = usePassportClock();
  const stats = useMemo(
    () => passportStats(films, watches, now),
    [films, watches, now],
  );
  const [chosenGenre, setChosenGenre] = useState('');
  const genre =
    stats.genres.find((g) => g.name === chosenGenre) ?? stats.genres[0];
  const slices = stats.genres
    .slice(0, 5)
    .map((g, i) => ({ ...g, color: COLORS[i] }));
  if (stats.genres.length > 5)
    slices.push({
      name: 'Другие',
      count: 0,
      weight: 0,
      percent: stats.genres.slice(5).reduce((sum, g) => sum + g.percent, 0),
      color: COLORS[5],
    });
  const gradient = slices
    .map((g, i) => {
      const start = slices
        .slice(0, i)
        .reduce((sum, s) => sum + s.percent * 3.6, 0);
      return `${g.color} ${start}deg ${start + g.percent * 3.6}deg`;
    })
    .join(',');
  const discoveryCountries = stats.discovery
    ? parseFilmCountries(stats.discovery.country).codes.filter(
        (code) => !stats.countries.byCountry.has(code),
      )
    : [];
  return (
    <section className="cinema-passport" aria-label="Личный кинопаспорт">
      <header className="passport-section-heading">
        <div>
          <span className="eyebrow">ТВОЙ УНИКАЛЬНЫЙ КИНОМАРШРУТ</span>
          <h2>
            Личный <em>кинопаспорт.</em>
          </h2>
          <p>Не просто сколько ты смотришь. А какой мир открываешь.</p>
        </div>
        <span className="passport-edition">
          <Stamp size={18} />
          <span>
            ЛИЧНАЯ КОЛЛЕКЦИЯ<small>ДАННЫЕ ТВОЕГО ДНЕВНИКА</small>
          </span>
        </span>
      </header>
      <div className="passport-grid">
        <article className="passport-widget passport-world hud-sync-tile">
          <div className="passport-widget-heading">
            <span>
              <Globe2 size={16} />
              Кино-карта мира
            </span>
            <small>01 / ГЕОГРАФИЯ</small>
          </div>
          <Suspense
            fallback={
              <div className="passport-globe-loading" role="status">
                <Globe2 size={48} />
                <span>Собираем твой атлас…</span>
              </div>
            }
          >
            <PassportGlobe
              countries={stats.countries.byCountry}
              unmapped={stats.countries.unmapped.length}
              go={go}
            />
          </Suspense>
          <div className="passport-attribution">
            Natural Earth / world-atlas · упрощённая географическая справка,
            не утверждение о границах.
          </div>
        </article>
        <article className="passport-widget passport-genres hud-sync-tile">
          <div className="passport-widget-heading">
            <span>
              <PieChart size={16} />
              Твой жанр месяца
            </span>
            <small>02 / ВКУС</small>
          </div>
          <div className="passport-month">
            {stats.month} · UTC · по просмотрам
          </div>
          {genre ? (
            <>
              <div className="passport-genre-visual">
                <div
                  className="passport-donut"
                  role="img"
                  aria-label={slices
                    .map((g) => `${g.name}: ${g.percent.toFixed(1)}%`)
                    .join(', ')}
                  style={
                    {
                      '--passport-donut': `conic-gradient(${gradient})`,
                    } as CSSProperties
                  }
                >
                  <span>
                    <b>{Math.round(genre.percent)}%</b>
                    <small>жанрового вклада</small>
                  </span>
                </div>
                <div>
                  <span className="eyebrow">
                    {chosenGenre && chosenGenre !== stats.genres[0]?.name
                      ? 'ВЫБРАННЫЙ ЖАНР'
                      : 'ЛИДЕР МЕСЯЦА'}
                  </span>
                  <h3>{genre.name}</h3>
                  <p>
                    {genre.count} из {stats.monthly.length} просмотренных
                    историй
                  </p>
                </div>
              </div>
              <div
                className="passport-genre-legend"
                role="group"
                aria-label="Жанры этого месяца"
              >
                {stats.genres.slice(0, 5).map((g, i) => (
                  <button
                    type="button"
                    key={g.name}
                    aria-pressed={genre.name === g.name}
                    onClick={() => setChosenGenre(g.name)}
                  >
                    <i style={{ background: COLORS[i] }} />
                    <span>{g.name}</span>
                    <b>{Math.round(g.percent)}%</b>
                  </button>
                ))}
              </div>
              <details className="passport-method">
                <summary>Как считается диаграмма?</summary>
                <p>
                  Учитываем уникальные материалы, отмеченные просмотренными в
                  этом месяце по UTC, не даты выхода. Вклад истории делится
                  поровну между её жанрами. Это вкус по просмотрам, не список
                  «Любимое».
                  {stats.genres.length > 5 &&
                    ` Другие жанры: ${stats.genres
                      .slice(5)
                      .map((g) => `${g.name} ${g.percent.toFixed(1)}%`)
                      .join(', ')}.`}
                  {stats.classified < stats.monthly.length &&
                    ` Без указанного жанра: ${stats.monthly.length - stats.classified}; в круг не включены.`}
                </p>
              </details>
            </>
          ) : (
            <div className="passport-empty">
              <PieChart size={34} />
              <h3>
                {stats.monthly.length
                  ? 'Жанры пока не указаны'
                  : 'Чистая страница месяца'}
              </h3>
              <p>
                Первый просмотр с указанным жанром начнёт твою диаграмму.
                Прошлая история остаётся в дневнике.
              </p>
              <button type="button" onClick={() => go('/catalog')}>
                Выбрать историю <ArrowUpRight size={14} />
              </button>
            </div>
          )}
        </article>
        <article className="passport-widget passport-streak hud-sync-tile">
          <div className="passport-widget-heading">
            <span>
              <Flame size={16} />
              Текущий стрик
            </span>
            <small>03 / РИТМ</small>
          </div>
          <div className="passport-streak-number">
            <Flame size={34} aria-hidden="true" />
            <strong>{stats.streak}</strong>
            <span>
              дней подряд
              <br />
              <small>Рекорд: {stats.best}</small>
            </span>
          </div>
          <div
            className="passport-week"
            aria-label="Последние семь дней по UTC"
          >
            {stats.week.map((day) => (
              <span
                key={day.day}
                className={day.active ? 'is-active' : ''}
                title={
                  new Date(day.day * 86_400_000).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    timeZone: 'UTC',
                  }) + (day.active ? ' · Есть просмотр' : ' · Нет просмотров')
                }
              >
                <i aria-hidden="true">
                  {day.active ? <Check size={13} /> : '·'}
                </i>
                <small>
                  {new Date(day.day * 86_400_000).toLocaleDateString(
                    'ru-RU',
                    {
                      weekday: 'short',
                      timeZone: 'UTC',
                    },
                  )}
                </small>
                <span className="hud-sr-only">
                  {new Date(day.day * 86_400_000).toISOString().slice(0, 10)}:{' '}
                  {day.active ? 'есть просмотр' : 'нет просмотров'}
                </span>
              </span>
            ))}
          </div>
          <p>
            {stats.watchedToday
              ? 'Сегодняшняя история уже в дневнике.'
              : stats.streak
                ? 'Серия сохранена со вчера. Можно продолжить сегодня.'
                : 'Каждая новая история — возможность начать новую серию.'}{' '}
            <span>Дни считаются по UTC. Без штрафов и потери XP.</span>
          </p>
        </article>
        <article className="passport-widget passport-discovery">
          <div className="passport-widget-heading">
            <span>
              <Compass size={16} />
              Следующий штамп
            </span>
            <small>04 / ОТКРЫТИЕ</small>
          </div>
          {stats.discovery ? (
            <button
              type="button"
              className="passport-story"
              onClick={() => go(`/movie/${stats.discovery!.id}`)}
            >
              <MaterialCover
                film={stats.discovery}
                badges={false}
                preview={false}
                className="passport-cover"
              />
              <span>
                <small>
                  НОВОЕ НАПРАВЛЕНИЕ ·{' '}
                  {discoveryCountries
                    .map((code) => countryName(code))
                    .join(', ')}
                </small>
                <b>{stats.discovery.title}</b>
                <span>{stats.discovery.year} · ещё не просмотрено</span>
              </span>
              <ArrowUpRight size={18} />
            </button>
          ) : (
            <div className="passport-empty compact">
              <b>Новые направления ещё появятся</b>
              <p>
                В текущем каталоге нет непросмотренной истории из новой для
                тебя страны.
              </p>
              <button type="button" onClick={() => go('/world?mode=watched')}>
                Исследовать атлас <ArrowUpRight size={14} />
              </button>
            </div>
          )}
        </article>
        <article className="passport-widget passport-memory">
          <div className="passport-widget-heading">
            <span>
              <Ticket size={16} />
              Последний штамп
            </span>
            <small>05 / ВОСПОМИНАНИЕ</small>
          </div>
          {stats.newest ? (
            <button
              type="button"
              className="passport-story"
              onClick={() => go(`/movie/${stats.newest!.id}`)}
            >
              <MaterialCover
                film={stats.newest}
                badges={false}
                preview={false}
                className="passport-cover"
              />
              <span>
                <small>НЕДАВНО В ТВОЁМ ДНЕВНИКЕ</small>
                <b>{stats.newest.title}</b>
                <span>
                  {stats.newest.year} ·{' '}
                  {parseFilmCountries(stats.newest.country)
                    .codes.map((code) => countryName(code))
                    .join(', ') || 'Страна не определена'}
                </span>
              </span>
              <ArrowUpRight size={18} />
            </button>
          ) : (
            <div className="passport-empty compact">
              <b>Твоя первая история впереди</b>
              <p>
                Отметь просмотренное кино, чтобы сохранить здесь первый штамп.
              </p>
              <button type="button" onClick={() => go('/catalog')}>
                Открыть каталог <ArrowUpRight size={14} />
              </button>
            </div>
          )}
        </article>
      </div>
      {stats.nextTitle && (
        <button
          type="button"
          className="passport-next-title"
          onClick={onTitles}
        >
          <Stamp size={19} />
          <span>
            Следующее звание: <b>{stats.nextTitle.name}</b>
            <small>
              Ещё {stats.nextTitle.target - stats.watched.length} уникальных
              историй. Звания открываются просмотрами; уровни растут за XP.
            </small>
          </span>
          <ArrowUpRight size={17} />
        </button>
      )}
    </section>
  );
}
