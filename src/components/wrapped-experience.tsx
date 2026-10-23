
'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type TouchEvent,
} from 'react';

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock3,
  Film,
  Heart,
  Loader2,
  RotateCcw,
  Share2,
  Sparkles,
  Star,
  Trophy,
  X,
} from 'lucide-react';

/* ============================================
   TYPES
============================================ */

type WrappedMovie = {
  id: number;
  title: string;
  poster: string | null;
};

type WrappedGenre = {
  name: string;
  count: number;
};

export type WrappedData = {
  year: number;
  username: string;

  watches: number;
  uniqueMovies: number;

  minutes: number;
  hours: number;
  days: number;

  topGenres: WrappedGenre[];

  months: number[];

  bestMonth: {
    name: string;
    count: number;
  } | null;

  averageRating: number | null;
  ratingsCount: number;

  bestMovie: {
    id: number;
    title: string;
    poster: string | null;
    rating: number;
  } | null;

  challengesCompleted: number;
  challengeXP: number;

  posters: WrappedMovie[];

  hasData: boolean;
};

type Props = {
  onClose: () => void;
  onShare?: (data: WrappedData, slide: number) => void;
};

const TOTAL_SLIDES = 9;

const MONTH_NAMES = [
  'Янв',
  'Фев',
  'Мар',
  'Апр',
  'Май',
  'Июн',
  'Июл',
  'Авг',
  'Сен',
  'Окт',
  'Ноя',
  'Дек',
];

const nf = new Intl.NumberFormat('ru-RU');

/* ============================================
   HELPERS
============================================ */

function getMovieTitle(count: number) {
  if (count === 1) return 'просмотр';
  if (count % 10 === 1 && count % 100 !== 11) {
    return 'просмотр';
  }

  if (
    count % 10 >= 2 &&
    count % 10 <= 4 &&
    (count % 100 < 12 || count % 100 > 14)
  ) {
    return 'просмотра';
  }

  return 'просмотров';
}

function getHoursTitle(count: number) {
  if (count % 10 === 1 && count % 100 !== 11) {
    return 'час';
  }

  if (
    count % 10 >= 2 &&
    count % 10 <= 4 &&
    (count % 100 < 12 || count % 100 > 14)
  ) {
    return 'часа';
  }

  return 'часов';
}

function getPersonality(data: WrappedData) {
  const genre = data.topGenres[0]?.name.toLowerCase() || '';

  if (data.watches >= 300) {
    return {
      title: 'Легенда кинозала',
      description:
        'Кажется, у тебя есть абонемент в параллельные вселенные.',
    };
  }

  if (genre.includes('ужас') || genre.includes('хоррор')) {
    return {
      title: 'Укротитель кошмаров',
      description:
        'Пока другие закрывают глаза, ты смотришь внимательнее.',
    };
  }

  if (genre.includes('триллер') || genre.includes('детектив')) {
    return {
      title: 'Охотник за сюжетами',
      description:
        'Ты подозреваешь каждого персонажа. И обычно не зря.',
    };
  }

  if (genre.includes('фантаст') || genre.includes('фэнтези')) {
    return {
      title: 'Путешественник по мирам',
      description:
        'Одной реальности тебе явно недостаточно.',
    };
  }

  if (genre.includes('комед')) {
    return {
      title: 'Главный по хорошему настроению',
      description:
        'Смех — тоже отличный повод включить кино.',
    };
  }

  if (genre.includes('романт') || genre.includes('мелодрам')) {
    return {
      title: 'Романтик большого экрана',
      description:
        'Веришь в любовь. Особенно под хороший саундтрек.',
    };
  }

  if (genre.includes('драм')) {
    return {
      title: 'Коллекционер эмоций',
      description:
        'Тебе нужны истории, которые остаются с тобой.',
    };
  }

  if (data.watches < 10) {
    return {
      title: 'Начинающий киноман',
      description:
        'Каждая большая киноистория начинается с первого просмотра.',
    };
  }

  return {
    title: 'Главный герой киногода',
    description:
      'У тебя собственный вкус. И собственная история.',
  };
}

function getWatchJoke(count: number) {
  if (count >= 200) {
    return 'Кнопка «Просмотрено» просит отпуск.';
  }

  if (count >= 100) {
    return '«Ещё один фильм» — твоя любимая фраза.';
  }

  if (count >= 30) {
    return 'Планы на вечер? Кажется, мы знаем ответ.';
  }

  if (count >= 10) {
    return 'Хорошее начало большой киноистории.';
  }

  return 'Главное не количество, а впечатления.';
}

function getTimeJoke(hours: number) {
  if (hours >= 300) {
    return 'За это время можно было освоить новый навык. Но кино тоже искусство.';
  }

  if (hours >= 100) {
    return 'Попкорн за это время точно успел закончиться.';
  }

  if (hours >= 20) {
    return 'Неплохое путешествие, не выходя из дома.';
  }

  return 'Даже короткая история может запомниться надолго.';
}

/* ============================================
   POSTER
============================================ */

function Poster({
  movie,
  className = '',
  style,
}: {
  movie?: WrappedMovie | null;
  className?: string;
  style?: CSSProperties;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`ww-poster ${className}`}
      style={style}
      title={movie?.title || 'moviemovie'}
    >
      {movie?.poster && !failed ? (
        <img
          src={movie.poster}
          alt={movie.title}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="ww-poster-fallback">
          <Clapperboard size={28} />
          <span>{movie?.title || 'moviemovie'}</span>
        </div>
      )}
    </div>
  );
}

/* ============================================
   MAIN COMPONENT
============================================ */

export default function WrappedExperience({
  onClose,
  onShare,
}: Props) {
  const [data, setData] = useState<WrappedData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [step, setStep] = useState(0);

  const [year, setYear] = useState(
    new Date().getUTCFullYear()
  );

  const [availableYears, setAvailableYears] = useState<number[]>([]);

  const touchStart = useRef<number | null>(null);

  /* ============================================
     DATA LOADING
  ============================================ */

  useEffect(() => {
    let cancelled = false;

    async function loadWrapped() {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(
          `/api/wrapped?year=${year}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          }
        );

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(
              'Войди в аккаунт, чтобы увидеть свой киногод.'
            );
          }

          throw new Error(
            'Не удалось загрузить итоги. Попробуй ещё раз.'
          );
        }

        const result: WrappedData = await response.json();

        if (!cancelled) {
          setData(result);
          setStep(0);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Произошла ошибка загрузки.'
          );
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadWrapped();

    return () => {
      cancelled = true;
    };
  }, [year]);

  /* ============================================
     YEARS
  ============================================ */

  useEffect(() => {
    const current = new Date().getUTCFullYear();

    const years: number[] = [];

    for (let y = current; y >= 2020; y--) {
      years.push(y);
    }

    setAvailableYears(years);
  }, []);

  /* ============================================
     NAVIGATION
  ============================================ */

  const next = useCallback(() => {
    setStep((current) =>
      Math.min(current + 1, TOTAL_SLIDES - 1)
    );
  }, []);

  const previous = useCallback(() => {
    setStep((current) => Math.max(current - 1, 0));
  }, []);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }

      if (event.key === 'ArrowRight') {
        next();
      }

      if (event.key === 'ArrowLeft') {
        previous();
      }
    }

    window.addEventListener('keydown', handleKey);

    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [next, previous, onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStart.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStart.current === null) return;

    const end = event.changedTouches[0]?.clientX;

    if (end === undefined) return;

    const difference = touchStart.current - end;

    if (Math.abs(difference) > 55) {
      if (difference > 0) {
        next();
      } else {
        previous();
      }
    }

    touchStart.current = null;
  }

  /* ============================================
     LOADING / ERROR
  ============================================ */

  if (loading) {
    return (
      <div className="ww-root">
        <WrappedStyles />

        <button
          className="ww-close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          <X size={21} />
        </button>

        <div className="ww-center">
          <Loader2 className="ww-spinner" size={42} />

          <h2>Монтируем твой киногод...</h2>

          <p>Собираем лучшие моменты.</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="ww-root">
        <WrappedStyles />

        <div className="ww-center">
          <Clapperboard size={48} />

          <h2>Что-то пошло не по сценарию</h2>

          <p>{error || 'Не удалось загрузить статистику.'}</p>

          <button className="ww-button" onClick={onClose}>
            Вернуться
          </button>
        </div>
      </div>
    );
  }

  /* ============================================
     EMPTY YEAR
  ============================================ */

  if (!data.hasData) {
    return (
      <div className="ww-root">
        <WrappedStyles />

        <button
          className="ww-close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          <X size={21} />
        </button>

        <div className="ww-center">
          <div className="ww-mini-label">
            MOVIEMOVIE / WRAPPED {year}
          </div>

          <Film size={58} />

          <h1>Пока без титров.</h1>

          <p>
            В {year} году ещё нет отмеченных просмотров.
            Добавь просмотренные фильмы, и здесь появится
            твоя история.
          </p>

          <div className="ww-year-row">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label="Выбрать год"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <button className="ww-button" onClick={onClose}>
              К фильмам
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const personality = getPersonality(data);

  const topGenre = data.topGenres[0];

  const maxMonth = Math.max(...data.months, 1);

  const topGenres = data.topGenres.slice(0, 5);

  const slides = [

    /* ============================================
       01 — INTRO
    ============================================ */

    <section className="ww-slide ww-intro" key="intro">
      <div className="ww-intro-posters">
        {data.posters.slice(0, 8).map((movie, index) => (
          <Poster
            key={`${movie.id}-${index}`}
            movie={movie}
            className={`ww-intro-poster ww-intro-poster-${index}`}
          />
        ))}
      </div>

      <div className="ww-intro-content">
        <div className="ww-eyebrow">
          <Sparkles size={15} />
          ТВОЯ ИСТОРИЯ / {data.year}
        </div>

        <h1>
          ЭТО
          <br />
          БЫЛО
          <br />
          <span>КИНО.</span>
        </h1>

        <p>
          Главный герой — ты.
          <br />
          И сейчас будут титры.
        </p>

        <button className="ww-button ww-button-light" onClick={next}>
          Погнали
          <ArrowRight size={19} />
        </button>
      </div>

      <div className="ww-slide-number">01 / 09</div>
    </section>,

    /* ============================================
       02 — TIME
    ============================================ */

    <section className="ww-slide ww-time" key="time">
      <div className="ww-section-label">
        <Clock3 size={18} />
        ВРЕМЯ В КИНО
      </div>

      <div className="ww-main-content">
        <div className="ww-kicker">
          В этом году ты посвятил кино
        </div>

        <div className="ww-big-number">
          {nf.format(data.hours)}
        </div>

        <h2>{getHoursTitle(data.hours)}</h2>

        <div className="ww-accent-line" />

        <p className="ww-description">
          {getTimeJoke(data.hours)}
        </p>

        <div className="ww-detail-chip">
          ≈ {data.days.toLocaleString('ru-RU')} суток
          экранных историй
        </div>
      </div>

      <div className="ww-background-text">TIME</div>
      <div className="ww-slide-number">02 / 09</div>
    </section>,

    /* ============================================
       03 — WATCHES
    ============================================ */

    <section className="ww-slide ww-watches" key="watches">
      <div className="ww-section-label">
        <Clapperboard size={18} />
        ТВОЯ КОЛЛЕКЦИЯ ВПЕЧАТЛЕНИЙ
      </div>

      <div className="ww-main-content">
        <div className="ww-kicker">
          За {data.year} год ты отметил
        </div>

        <div className="ww-big-number">
          {nf.format(data.watches)}
        </div>

        <h2>{getMovieTitle(data.watches)}</h2>

        <p className="ww-description">
          {getWatchJoke(data.watches)}
        </p>

        <div className="ww-stat-cards">
          <div className="ww-stat-card">
            <strong>{nf.format(data.uniqueMovies)}</strong>
            <span>уникальных историй</span>
          </div>

          <div className="ww-stat-card">
            <strong>{nf.format(data.watches)}</strong>
            <span>отметок просмотра</span>
          </div>
        </div>
      </div>

      <div className="ww-background-text">PLAY</div>
      <div className="ww-slide-number">03 / 09</div>
    </section>,

    /* ============================================
       04 — GENRES
    ============================================ */

    <section className="ww-slide ww-genres" key="genres">
      <div className="ww-section-label">
        <Sparkles size={18} />
        ТВОЯ ЖАНРОВАЯ ДУША
      </div>

      <div className="ww-genres-content">
        <div className="ww-kicker">
          Кажется, у твоего вкуса есть характер
        </div>

        <h2>{topGenre?.name || 'Кино'}</h2>

        <p className="ww-description">
          {topGenre
            ? `${topGenre.count} просмотров с этим жанром. Совпадение? Не думаем.`
            : 'Хорошее кино не обязано помещаться в один жанр.'}
        </p>

        <div className="ww-genre-list">
          {topGenres.map((genre, index) => (
            <div className="ww-genre-item" key={genre.name}>
              <div className="ww-genre-info">
                <span>
                  {String(index + 1).padStart(2, '0')}
                  <b>{genre.name}</b>
                </span>

                <strong>{genre.count}</strong>
              </div>

              <div className="ww-genre-track">
                <div
                  style={{
                    width: `${
                      (genre.count / Math.max(topGenre?.count || 1, 1)) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ww-slide-number">04 / 09</div>
    </section>,

    /* ============================================
       05 — RATINGS
    ============================================ */

    <section className="ww-slide ww-ratings" key="ratings">
      <div className="ww-section-label">
        <Star size={18} />
        ТВОЙ ВЕРДИКТ
      </div>

      <div className="ww-main-content">
        <div className="ww-kicker">
          Средняя оценка просмотренного
        </div>

        <div className="ww-rating-number">
          {data.averageRating !== null
            ? data.averageRating.toLocaleString('ru-RU', {
                maximumFractionDigits: 1,
              })
            : '—'}
          <span>/10</span>
        </div>

        <h2>
          {data.ratingsCount > 0
            ? 'Кинокритики напряглись.'
            : 'Жюри пока молчит.'}
        </h2>

        <p className="ww-description">
          {data.ratingsCount > 0
            ? `Оценены ${nf.format(data.ratingsCount)} материалов из просмотренных в ${data.year} году.`
            : 'Похоже, ты предпочитаешь наслаждаться кино без оценок.'}
        </p>

        <div className="ww-rating-stars">
          {Array.from({ length: 5 }).map((_, index) => (
            <Star
              key={index}
              size={30}
              fill={
                data.averageRating !== null &&
                index < Math.round(data.averageRating / 2)
                  ? 'currentColor'
                  : 'none'
              }
            />
          ))}
        </div>
      </div>

      <div className="ww-background-text">RATE</div>
      <div className="ww-slide-number">05 / 09</div>
    </section>,

    /* ============================================
       06 — BEST MOVIE
    ============================================ */

    <section className="ww-slide ww-best" key="best">
      {data.bestMovie?.poster && (
        <div
          className="ww-best-backdrop"
          style={{
            backgroundImage: `url("${data.bestMovie.poster.replace(
              /"/g,
              '%22'
            )}")`,
          }}
        />
      )}

      <div className="ww-section-label">
        <Trophy size={18} />
        ФИЛЬМ ГОДА
      </div>

      <div className="ww-best-content">
        <div className="ww-best-poster-wrap">
          <Poster movie={data.bestMovie} />
        </div>

        <div className="ww-best-info">
          <div className="ww-kicker">
            И твой личный «Оскар» получает...
          </div>

          <h2>
            {data.bestMovie?.title ||
              'Интрига сохраняется'}
          </h2>

          {data.bestMovie ? (
            <div className="ww-best-rating">
              <Star size={20} fill="currentColor" />
              {data.bestMovie.rating}/10
            </div>
          ) : (
            <p>
              Поставь оценки просмотренным фильмам,
              чтобы выбрать фаворита.
            </p>
          )}

          <p className="ww-description">
            {data.bestMovie
              ? 'Один из твоих самых высоко оценённых фильмов этого киногода.'
              : 'Главная роль пока свободна.'}
          </p>
        </div>
      </div>

      <div className="ww-slide-number">06 / 09</div>
    </section>,

    /* ============================================
       07 — MONTHS
    ============================================ */

    <section className="ww-slide ww-months" key="months">
      <div className="ww-section-label">
        <Film size={18} />
        КИНОКАЛЕНДАРЬ
      </div>

      <div className="ww-months-content">
        <div className="ww-kicker">
          Больше всего отметок просмотра
        </div>

        <h2>
          {data.bestMonth?.name || 'Весь год'}
        </h2>

        <p className="ww-description">
          {data.bestMonth
            ? `${data.bestMonth.count} отметок просмотра. Кнопка «Просмотрено» поработала на славу.`
            : 'Каждый месяц может стать началом новой истории.'}
        </p>

        <div className="ww-chart">
          {MONTH_NAMES.map((month, index) => {
            const value = data.months[index] || 0;

            return (
              <div className="ww-chart-column" key={month}>
                <span className="ww-chart-value">
                  {value || ''}
                </span>

                <div className="ww-chart-track">
                  <div
                    className={
                      value === maxMonth && value > 0
                        ? 'ww-chart-bar active'
                        : 'ww-chart-bar'
                    }
                    style={{
                      height:
                        value > 0
                          ? `${Math.max(
                              (value / maxMonth) * 100,
                              7
                            )}%`
                          : '3px',
                    }}
                  />
                </div>

                <span className="ww-chart-label">
                  {month}
                </span>
              </div>
            );
          })}
        </div>

        <div className="ww-note">
          График основан на датах отметок «Просмотрено».
          Они могут отличаться от реальных дат просмотра.
        </div>
      </div>

      <div className="ww-slide-number">07 / 09</div>
    </section>,

    /* ============================================
       08 — CHALLENGES
    ============================================ */

    <section className="ww-slide ww-challenges" key="challenges">
      <div className="ww-section-label">
        <Trophy size={18} />
        ДОПОЛНИТЕЛЬНЫЕ КВЕСТЫ
      </div>

      <div className="ww-main-content">
        <div className="ww-trophy-icon">
          <Trophy size={54} />
        </div>

        <div className="ww-kicker">
          Побочные задания? Выполнены.
        </div>

        <div className="ww-big-number">
          {nf.format(data.challengesCompleted)}
        </div>

        <h2>челленджей пройдено</h2>

        <div className="ww-xp-badge">
          <Sparkles size={22} />
          +{nf.format(data.challengeXP)} XP
        </div>

        <p className="ww-description">
          {data.challengesCompleted > 0
            ? 'Награды получены. Репутация киномана растёт.'
            : 'Пока без выполненных челленджей. Но впереди ещё много заданий.'}
        </p>
      </div>

      <div className="ww-background-text">LEVEL UP</div>
      <div className="ww-slide-number">08 / 09</div>
    </section>,

    /* ============================================
       09 — FINAL
    ============================================ */

    <section className="ww-slide ww-final" key="final">
      <div className="ww-section-label">
        <Heart size={18} />
        MOVIEMOVIE WRAPPED {data.year}
      </div>

      <div className="ww-final-content">
        <div className="ww-final-heading">
          <span>ГЛАВНЫЙ ГЕРОЙ</span>

          <h2>
            ЭТОГО
            <br />
            КИНОГОДА
            <br />
            <em>— ТЫ.</em>
          </h2>
        </div>

        <div className="ww-final-card">
          <div className="ww-final-card-top">
            <span>moviemovie.</span>
            <span>WRAPPED / {data.year}</span>
          </div>

          <div className="ww-final-user">
            @{data.username}
          </div>

          <div className="ww-final-personality">
            {personality.title}
          </div>

          <p>{personality.description}</p>

          <div className="ww-final-stats">
            <div>
              <strong>{nf.format(data.watches)}</strong>
              <span>просмотров</span>
            </div>

            <div>
              <strong>{nf.format(data.hours)}</strong>
              <span>часов кино</span>
            </div>

            <div>
              <strong>
                {data.averageRating !== null
                  ? data.averageRating.toLocaleString('ru-RU', {
                      maximumFractionDigits: 1,
                    })
                  : '—'}
              </strong>
              <span>средняя оценка</span>
            </div>
          </div>

          <div className="ww-final-genre">
            <Sparkles size={16} />
            ТВОЙ ЖАНР: {topGenre?.name || 'Кино'}
          </div>

          <div className="ww-final-posters">
            {data.posters.slice(0, 5).map((movie, index) => (
              <Poster
                key={`${movie.id}-${index}`}
                movie={movie}
              />
            ))}
          </div>
        </div>

        <div className="ww-final-actions">
          {onShare && (
            <button
              className="ww-button ww-button-light"
              onClick={() => onShare(data, step)}
            >
              <Share2 size={19} />
              Поделиться
            </button>
          )}

          <button
            className="ww-button ww-button-outline"
            onClick={() => setStep(0)}
          >
            <RotateCcw size={18} />
            Ещё раз
          </button>

          <button
            className="ww-button ww-button-ghost"
            onClick={onClose}
          >
            Завершить
            <Check size={18} />
          </button>
        </div>
      </div>

      <div className="ww-slide-number">09 / 09</div>
    </section>,
  ];

  /* ============================================
     RENDER
  ============================================ */

  return (
    <div
      className="ww-root"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-label={`moviemovie Wrapped ${data.year}`}
    >
      <WrappedStyles />

      {/* Top progress */}

      <div className="ww-topbar">
        <div className="ww-progress">
          {Array.from({ length: TOTAL_SLIDES }).map((_, index) => (
            <button
              key={index}
              className={
                index === step
                  ? 'ww-progress-item active'
                  : index < step
                    ? 'ww-progress-item completed'
                    : 'ww-progress-item'
              }
              onClick={() => setStep(index)}
              aria-label={`Перейти к экрану ${index + 1}`}
              aria-current={index === step ? 'step' : undefined}
            >
              <span />
            </button>
          ))}
        </div>

        <div className="ww-top-actions">
          <span className="ww-brand">
            moviemovie<span>.</span>
          </span>

          <select
            className="ww-year-select"
            value={year}
            onChange={(event) =>
              setYear(Number(event.target.value))
            }
            aria-label="Выбрать год"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            className="ww-top-close"
            onClick={onClose}
            aria-label="Закрыть Wrapped"
          >
            <X size={21} />
          </button>
        </div>
      </div>

      {/* Slides */}

      <div className="ww-stage">
        <div className="ww-slide-animation" key={`${year}-${step}`}>
          {slides[step]}
        </div>
      </div>

      {/* Navigation */}

      <div className="ww-navigation">
        <button
          onClick={previous}
          disabled={step === 0}
          aria-label="Предыдущий экран"
        >
          <ChevronLeft size={25} />
        </button>

        <span>
          {String(step + 1).padStart(2, '0')}
          <span className="ww-nav-divider">/</span>
          {String(TOTAL_SLIDES).padStart(2, '0')}
        </span>

        <button
          onClick={next}
          disabled={step === TOTAL_SLIDES - 1}
          aria-label="Следующий экран"
        >
          <ChevronRight size={25} />
        </button>
      </div>

      {/* Desktop navigation zones */}

      {step > 0 && (
        <button
          className="ww-side-zone ww-side-left"
          onClick={previous}
          aria-label="Назад"
        >
          <ArrowLeft size={24} />
        </button>
      )}

      {step < TOTAL_SLIDES - 1 && (
        <button
          className="ww-side-zone ww-side-right"
          onClick={next}
          aria-label="Далее"
        >
          <ArrowRight size={24} />
        </button>
      )}
    </div>
  );
}

/* ============================================
   STYLES
   Self-contained to avoid changing globals.css
============================================ */

function WrappedStyles() {
  return (
    <style>{`

      .ww-root {
        position: fixed;
        inset: 0;
        z-index: 99999;
        overflow: hidden;
        background: #101014;
        color: #fff;
        font-family: 'Golos Text', 'Rubik', Arial, sans-serif;
        isolation: isolate;
      }

      .ww-root * {
        box-sizing: border-box;
      }

      .ww-root button {
        font: inherit;
        cursor: pointer;
      }

      .ww-root button:disabled {
        opacity: .25;
        cursor: default;
      }

      .ww-topbar {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        z-index: 30;
        padding: 20px 32px;
        background: linear-gradient(
          to bottom,
          rgba(0,0,0,.35),
          transparent
        );
      }

      .ww-progress {
        display: flex;
        gap: 5px;
      }

      .ww-progress-item {
        flex: 1;
        height: 4px;
        padding: 0;
        border: 0;
        background: rgba(255,255,255,.25);
        border-radius: 10px;
        overflow: hidden;
      }

      .ww-progress-item span {
        display: block;
        height: 100%;
        width: 0;
        background: #d8ff63;
        border-radius: inherit;
        transition: width .35s ease;
      }

      .ww-progress-item.active span,
      .ww-progress-item.completed span {
        width: 100%;
      }

      .ww-top-actions {
        display: flex;
        align-items: center;
        gap: 16px;
        padding-top: 17px;
      }

      .ww-brand {
        margin-right: auto;
        font-size: 18px;
        font-weight: 900;
        letter-spacing: -1px;
      }

      .ww-brand span {
        color: #d8ff63;
      }

      .ww-year-select {
        padding: 7px 11px;
        color: #fff;
        background: rgba(255,255,255,.12);
        border: 1px solid rgba(255,255,255,.16);
        border-radius: 9px;
        outline: none;
        font-weight: 700;
        cursor: pointer;
      }

      .ww-year-select option {
        background: #17171d;
        color: #fff;
      }

      .ww-top-close,
      .ww-close {
        display: grid;
        place-items: center;
        width: 37px;
        height: 37px;
        color: #fff;
        background: rgba(255,255,255,.12);
        border: 1px solid rgba(255,255,255,.15);
        border-radius: 50%;
      }

      .ww-close {
        position: absolute;
        top: 24px;
        right: 24px;
        z-index: 30;
      }

      .ww-stage,
      .ww-slide-animation,
      .ww-slide {
        width: 100%;
        height: 100%;
      }

      .ww-stage {
        position: relative;
      }

      .ww-slide-animation {
        animation: ww-enter .55s cubic-bezier(.2,.7,.2,1) both;
      }

      @keyframes ww-enter {
        from {
          opacity: 0;
          transform: translateY(15px) scale(.985);
        }

        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .ww-slide {
        position: relative;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 135px max(9vw, 70px) 105px;
      }

      .ww-section-label,
      .ww-eyebrow {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 2px;
        text-transform: uppercase;
      }

      .ww-kicker {
        font-size: clamp(15px, 2vw, 21px);
        font-weight: 600;
        opacity: .75;
        line-height: 1.45;
      }

      .ww-slide h1,
      .ww-slide h2 {
        margin: 0;
        font-family: 'Unbounded', 'Rubik', Arial, sans-serif;
        font-weight: 900;
        letter-spacing: -2px;
        line-height: 1.1;
      }

      .ww-main-content {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        flex: 1;
        max-width: 1000px;
      }

      .ww-big-number {
        margin-top: 15px;
        font-family: 'Unbounded', sans-serif;
        font-size: clamp(90px, 17vw, 260px);
        font-weight: 900;
        line-height: 1.1;
        letter-spacing: -12px;
      }

      .ww-main-content h2 {
        font-size: clamp(29px, 5vw, 65px);
      }

      .ww-description {
        max-width: 560px;
        margin-top: 25px;
        font-size: clamp(16px, 1.8vw, 22px);
        line-height: 1.55;
        opacity: .8;
      }

      .ww-slide-number {
        position: absolute;
        right: 35px;
        bottom: 27px;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 2px;
        opacity: .45;
      }

      .ww-background-text {
        position: absolute;
        right: -2vw;
        bottom: 7vh;
        z-index: 0;
        font-family: 'Unbounded', sans-serif;
        font-size: clamp(100px, 20vw, 350px);
        font-weight: 900;
        white-space: nowrap;
        letter-spacing: -20px;
        opacity: .045;
        pointer-events: none;
      }

      /* INTRO */

      .ww-intro {
        justify-content: center;
        background: #14141a;
      }

      .ww-intro::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg,
          #14141a 4%,
          rgba(20,20,26,.96) 32%,
          rgba(20,20,26,.35) 100%
        );
        pointer-events: none;
      }

      .ww-intro-content {
        position: relative;
        z-index: 2;
      }

      .ww-intro h1 {
        margin: 27px 0;
        font-size: clamp(65px, 10vw, 160px);
        letter-spacing: -8px;
      }

      .ww-intro h1 span {
        color: #d8ff63;
      }

      .ww-intro p {
        font-size: clamp(18px, 2vw, 25px);
        font-weight: 500;
        line-height: 1.6;
        margin-bottom: 29px;
      }

      .ww-intro-posters {
        position: absolute;
        inset: 0;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 15px;
        width: 65%;
        height: 120%;
        left: 49%;
        top: -10%;
        transform: rotate(-12deg);
      }

      .ww-intro-poster {
        width: 100%;
        height: 100%;
        opacity: .9;
      }

      .ww-intro-poster:nth-child(even) {
        transform: translateY(65px);
      }

      /* POSTERS */

      .ww-poster {
        overflow: hidden;
        background: linear-gradient(
          145deg,
          #353543,
          #191921
        );
        border-radius: 13px;
      }

      .ww-poster img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .ww-poster-fallback {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        width: 100%;
        height: 100%;
        padding: 15px;
        color: rgba(255,255,255,.6);
        text-align: center;
        font-size: 12px;
      }

      /* BUTTONS */

      .ww-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        min-height: 52px;
        padding: 14px 23px;
        color: #101014;
        background: #d8ff63;
        border: 0;
        border-radius: 13px;
        font-size: 15px;
        font-weight: 900;
        transition: transform .2s, background .2s;
      }

      .ww-button:hover {
        transform: translateY(-2px);
      }

      .ww-button-light {
        background: #d8ff63;
        color: #111;
      }

      .ww-button-outline {
        background: transparent;
        color: #fff;
        border: 1px solid rgba(255,255,255,.3);
      }

      .ww-button-ghost {
        background: rgba(255,255,255,.1);
        color: #fff;
      }

      /* TIME */

      .ww-time {
        background: #111317;
      }

      .ww-time .ww-big-number {
        color: #d8ff63;
      }

      .ww-accent-line {
        width: 95px;
        height: 5px;
        margin-top: 28px;
        background: #d8ff63;
        border-radius: 20px;
      }

      .ww-detail-chip {
        margin-top: 12px;
        padding: 13px 18px;
        background: rgba(216,255,99,.1);
        border: 1px solid rgba(216,255,99,.25);
        border-radius: 12px;
        color: #d8ff63;
        font-weight: 800;
      }

      /* WATCHES */

      .ww-watches {
        background: #f4f1eb;
        color: #19191f;
      }

      .ww-watches .ww-big-number {
        color: #ef6654;
      }

      .ww-watches .ww-description {
        opacity: .75;
      }

      .ww-stat-cards {
        display: flex;
        gap: 13px;
        margin-top: 18px;
      }

      .ww-stat-card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 175px;
        padding: 20px;
        background: #fff;
        border: 1px solid #e5e1da;
        border-radius: 17px;
      }

      .ww-stat-card strong {
        font-family: 'Unbounded', sans-serif;
        font-size: 27px;
      }

      .ww-stat-card span {
        font-size: 12px;
        font-weight: 700;
        opacity: .6;
      }

      /* GENRES */

      .ww-genres {
        background: #d8ff63;
        color: #181b16;
      }

      .ww-genres-content {
        display: flex;
        flex-direction: column;
        justify-content: center;
        flex: 1;
        width: 100%;
        max-width: 900px;
      }

      .ww-genres h2 {
        margin: 20px 0 0;
        font-size: clamp(45px, 8vw, 105px);
        overflow-wrap: anywhere;
      }

      .ww-genres .ww-description {
        margin-top: 17px;
        opacity: .8;
      }

      .ww-genre-list {
        display: flex;
        flex-direction: column;
        gap: 19px;
        margin-top: 35px;
        width: 100%;
        max-width: 720px;
      }

      .ww-genre-info {
        display: flex;
        justify-content: space-between;
        margin-bottom: 9px;
        font-size: 15px;
        font-weight: 800;
      }

      .ww-genre-info span {
        display: flex;
        gap: 17px;
      }

      .ww-genre-info strong {
        font-family: 'Unbounded', sans-serif;
      }

      .ww-genre-track {
        height: 11px;
        background: rgba(0,0,0,.12);
        border-radius: 20px;
        overflow: hidden;
      }

      .ww-genre-track div {
        height: 100%;
        background: #1b1d18;
        border-radius: inherit;
        animation: ww-bar .7s ease both;
        transform-origin: left;
      }

      @keyframes ww-bar {
        from { transform: scaleX(0); }
        to { transform: scaleX(1); }
      }

      /* RATINGS */

      .ww-ratings {
        background: #f26d59;
        color: #201918;
      }

      .ww-rating-number {
        margin: 25px 0;
        font-family: 'Unbounded', sans-serif;
        font-size: clamp(85px, 16vw, 220px);
        font-weight: 900;
        line-height: 1;
        letter-spacing: -9px;
      }

      .ww-rating-number span {
        font-size: clamp(25px, 4vw, 55px);
        letter-spacing: -2px;
        opacity: .55;
      }

      .ww-rating-stars {
        display: flex;
        gap: 12px;
        margin-top: 14px;
      }

      /* BEST MOVIE */

      .ww-best {
        background: #111219;
      }

      .ww-best-backdrop {
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center;
        filter: blur(55px) brightness(.3);
        transform: scale(1.15);
        opacity: .8;
      }

      .ww-best-content {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: clamp(30px, 6vw, 100px);
        flex: 1;
      }

      .ww-best-poster-wrap {
        flex: 0 0 auto;
        width: clamp(200px, 27vw, 370px);
        aspect-ratio: 2 / 3;
        transform: rotate(-4deg);
        box-shadow: 0 30px 80px rgba(0,0,0,.4);
      }

      .ww-best-poster-wrap .ww-poster {
        width: 100%;
        height: 100%;
      }

      .ww-best-info {
        max-width: 600px;
      }

      .ww-best-info h2 {
        margin-top: 20px;
        font-size: clamp(35px, 5vw, 75px);
        overflow-wrap: anywhere;
      }

      .ww-best-rating {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        margin-top: 20px;
        padding: 10px 17px;
        color: #181818;
        background: #d8ff63;
        border-radius: 10px;
        font-size: 22px;
        font-weight: 900;
      }

      /* MONTHS */

      .ww-months {
        background: #202735;
      }

      .ww-months-content {
        display: flex;
        flex-direction: column;
        justify-content: center;
        flex: 1;
        max-width: 1050px;
      }

      .ww-months h2 {
        margin-top: 14px;
        font-size: clamp(50px, 8vw, 105px);
        color: #8db8ff;
      }

      .ww-chart {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        gap: 11px;
        height: 230px;
        margin-top: 40px;
      }

      .ww-chart-column {
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 0;
        gap: 8px;
      }

      .ww-chart-value {
        height: 18px;
        font-size: 11px;
        font-weight: 900;
      }

      .ww-chart-track {
        display: flex;
        align-items: flex-end;
        width: 100%;
        flex: 1;
      }

      .ww-chart-bar {
        width: 100%;
        min-height: 3px;
        background: #536580;
        border-radius: 7px 7px 2px 2px;
      }

      .ww-chart-bar.active {
        background: #8db8ff;
      }

      .ww-chart-label {
        font-size: 12px;
        font-weight: 700;
        opacity: .7;
      }

      .ww-note {
        max-width: 720px;
        margin-top: 23px;
        font-size: 12px;
        line-height: 1.6;
        opacity: .55;
      }

      /* CHALLENGES */

      .ww-challenges {
        background: #224de2;
      }

      .ww-trophy-icon {
        display: grid;
        place-items: center;
        width: 105px;
        height: 105px;
        margin-bottom: 28px;
        background: rgba(255,255,255,.13);
        border: 1px solid rgba(255,255,255,.2);
        border-radius: 25px;
        transform: rotate(-8deg);
      }

      .ww-xp-badge {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        margin-top: 28px;
        padding: 15px 23px;
        background: #d8ff63;
        color: #161616;
        border-radius: 13px;
        font-family: 'Unbounded', sans-serif;
        font-size: clamp(18px, 3vw, 30px);
        font-weight: 900;
      }

      /* FINAL */

      .ww-final {
        background: #141419;
      }

      .ww-final-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 1;
        padding-top: 25px;
      }

      .ww-final-heading {
        width: 100%;
        max-width: 670px;
        margin-bottom: 22px;
      }

      .ww-final-heading > span {
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 3px;
        color: #d8ff63;
      }

      .ww-final-heading h2 {
        margin-top: 9px;
        font-size: clamp(30px, 5vw, 56px);
      }

      .ww-final-heading em {
        color: #d8ff63;
        font-style: normal;
      }

      .ww-final-card {
        width: 100%;
        max-width: 670px;
        padding: 28px;
        background: linear-gradient(
          145deg,
          #292b38,
          #1c1e27
        );
        border: 1px solid rgba(255,255,255,.15);
        border-radius: 22px;
        box-shadow: 0 24px 70px rgba(0,0,0,.25);
      }

      .ww-final-card-top {
        display: flex;
        justify-content: space-between;
        gap: 15px;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 1px;
      }

      .ww-final-card-top span:first-child {
        color: #d8ff63;
        font-size: 17px;
        letter-spacing: -1px;
      }

      .ww-final-user {
        margin-top: 27px;
        font-size: 15px;
        color: #d8ff63;
        font-weight: 800;
      }

      .ww-final-personality {
        margin-top: 9px;
        font-family: 'Unbounded', sans-serif;
        font-size: clamp(19px, 3vw, 30px);
        font-weight: 900;
        line-height: 1.3;
      }

      .ww-final-card > p {
        margin-top: 10px;
        font-size: 13px;
        line-height: 1.6;
        opacity: .65;
      }

      .ww-final-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-top: 22px;
      }

      .ww-final-stats > div {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 15px;
        background: rgba(255,255,255,.07);
        border-radius: 12px;
      }

      .ww-final-stats strong {
        font-family: 'Unbounded', sans-serif;
        font-size: clamp(20px, 3vw, 29px);
      }

      .ww-final-stats span {
        font-size: 11px;
        opacity: .65;
      }

      .ww-final-genre {
        display: flex;
        align-items: center;
        gap: 9px;
        margin-top: 20px;
        color: #d8ff63;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: .7px;
      }

      .ww-final-posters {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 8px;
        height: 105px;
        margin-top: 20px;
      }

      .ww-final-posters .ww-poster {
        height: 100%;
        border-radius: 7px;
      }

      .ww-final-actions {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 23px;
      }

      /* NAVIGATION */

      .ww-navigation {
        position: absolute;
        bottom: 25px;
        left: 50%;
        z-index: 20;
        display: flex;
        align-items: center;
        gap: 22px;
        transform: translateX(-50%);
      }

      .ww-navigation button {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border: 1px solid rgba(255,255,255,.3);
        border-radius: 50%;
        background: rgba(15,15,20,.8);
        color: #fff;
      }

      .ww-navigation > span {
        display: flex;
        gap: 7px;
        color: #fff;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 2px;
      }

      .ww-nav-divider {
        opacity: .45;
      }

      .ww-side-zone {
        position: absolute;
        top: 48%;
        z-index: 15;
        display: grid;
        place-items: center;
        width: 45px;
        height: 65px;
        color: #fff;
        background: rgba(0,0,0,.14);
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 12px;
        transition: background .2s;
      }

      .ww-side-zone:hover {
        background: rgba(0,0,0,.4);
      }

      .ww-side-left {
        left: 15px;
      }

      .ww-side-right {
        right: 15px;
      }

      /* STATES */

      .ww-center {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 20px;
        width: 100%;
        height: 100%;
        padding: 35px;
        text-align: center;
      }

      .ww-center h1,
      .ww-center h2 {
        margin: 0;
        font-family: 'Unbounded', sans-serif;
        font-size: clamp(25px, 5vw, 48px);
        line-height: 1.3;
      }

      .ww-center p {
        max-width: 480px;
        line-height: 1.7;
        opacity: .65;
      }

      .ww-spinner {
        color: #d8ff63;
        animation: ww-spin 1s linear infinite;
      }

      @keyframes ww-spin {
        to { transform: rotate(360deg); }
      }

      .ww-mini-label {
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 2px;
        color: #d8ff63;
      }

      .ww-year-row {
        display: flex;
        gap: 12px;
        align-items: center;
      }

      .ww-year-row select {
        padding: 15px;
        color: #fff;
        background: #24242c;
        border: 1px solid #444;
        border-radius: 12px;
      }

      /* MOBILE */

      @media (max-width: 700px) {

        .ww-topbar {
          padding: 15px 16px;
        }

        .ww-brand {
          font-size: 16px;
        }

        .ww-top-actions {
          gap: 10px;
          padding-top: 14px;
        }

        .ww-slide {
          padding: 120px 25px 105px;
        }

        .ww-section-label,
        .ww-eyebrow {
          font-size: 10px;
          letter-spacing: 1.5px;
        }

        .ww-slide h1,
        .ww-slide h2 {
          letter-spacing: -1.5px;
        }

        .ww-intro {
          justify-content: flex-end;
          padding-bottom: 155px;
        }

        .ww-intro::after {
          background: linear-gradient(
            to top,
            #14141a 16%,
            rgba(20,20,26,.88) 38%,
            rgba(20,20,26,.25) 100%
          );
        }

        .ww-intro-posters {
          width: 120%;
          height: 75%;
          top: -17%;
          left: -10%;
        }

        .ww-intro h1 {
          font-size: clamp(65px, 15vw, 100px);
          letter-spacing: -5px;
        }

        .ww-intro p {
          font-size: 17px;
        }

        .ww-big-number {
          font-size: clamp(75px, 19vw, 135px);
          letter-spacing: -6px;
        }

        .ww-main-content h2 {
          font-size: clamp(25px, 7vw, 42px);
        }

        .ww-description {
          font-size: 15px;
        }

        .ww-stat-cards {
          width: 100%;
        }

        .ww-stat-card {
          flex: 1;
          min-width: 0;
          padding: 14px;
        }

        .ww-stat-card strong {
          font-size: 19px;
        }

        .ww-stat-card span {
          font-size: 10px;
        }

        .ww-genres h2 {
          font-size: clamp(42px, 11vw, 72px);
        }

        .ww-genre-list {
          gap: 16px;
          margin-top: 25px;
        }

        .ww-genre-info {
          font-size: 12px;
        }

        .ww-rating-number {
          font-size: clamp(75px, 18vw, 120px);
          letter-spacing: -5px;
        }

        .ww-best-content {
          flex-direction: column;
          align-items: flex-start;
          gap: 30px;
        }

        .ww-best-poster-wrap {
          width: min(47vw, 210px);
        }

        .ww-best-info h2 {
          margin-top: 12px;
          font-size: clamp(27px, 7vw, 43px);
        }

        .ww-best-info .ww-description {
          margin-top: 12px;
        }

        .ww-chart {
          gap: 4px;
          height: 200px;
        }

        .ww-chart-label {
          font-size: 9px;
        }

        .ww-chart-value {
          font-size: 9px;
        }

        .ww-months h2 {
          font-size: clamp(45px, 11vw, 75px);
        }

        .ww-trophy-icon {
          width: 85px;
          height: 85px;
        }

        .ww-final {
          padding-top: 115px;
          padding-bottom: 85px;
        }

        .ww-final-content {
          justify-content: flex-start;
          padding-top: 15px;
        }

        .ww-final-heading {
          margin-bottom: 17px;
        }

        .ww-final-heading h2 {
          font-size: clamp(25px, 7vw, 40px);
        }

        .ww-final-card {
          padding: 18px;
          border-radius: 17px;
        }

        .ww-final-stats {
          gap: 6px;
        }

        .ww-final-stats > div {
          padding: 11px 8px;
        }

        .ww-final-stats strong {
          font-size: 18px;
        }

        .ww-final-stats span {
          font-size: 9px;
        }

        .ww-final-personality {
          font-size: 19px;
        }

        .ww-final-posters {
          height: 80px;
        }

        .ww-final-actions {
          width: 100%;
        }

        .ww-final-actions .ww-button {
          flex: 1;
          min-height: 45px;
          padding: 11px;
          font-size: 12px;
        }

        .ww-side-zone {
          display: none;
        }

        .ww-navigation {
          bottom: 19px;
        }

        .ww-slide-number {
          display: none;
        }

      }

      @media (max-height: 740px) {
        .ww-slide {
          padding-top: 110px;
          padding-bottom: 90px;
        }

        .ww-intro h1 {
          margin: 12px 0;
        }

        .ww-final-card {
          padding: 16px;
        }

        .ww-final-posters {
          height: 65px;
        }

        .ww-final-heading {
          margin-bottom: 12px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .ww-root *,
        .ww-root *::before,
        .ww-root *::after {
          animation-duration: .01ms !important;
          transition-duration: .01ms !important;
        }
      }

    `}</style>
  );
}
