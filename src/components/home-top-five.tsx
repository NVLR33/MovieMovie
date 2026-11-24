'use client';
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  Film as FilmIcon,
  Heart,
  Star,
} from 'lucide-react';
import type { Film } from '@/lib/data';
import {
  materialTopUrl,
  rankMaterials,
  type MaterialMetric,
} from '@/lib/material-ranking';
import MediaPoster, { MediaAge } from './media-poster';
import { formatFilmRating } from '@/lib/rating-display';

function Cover({ film }: { film: Film }) {
  return (
    <MediaPoster src={film.poster} className="home-five-poster">
      <MediaAge value={film.ageRating} className="home-five-age" />
    </MediaPoster>
  );
}
export default function HomeTopFive({
  films,
  go,
  en = false,
}: {
  films: Film[];
  go: (url: string) => void;
  en?: boolean;
}) {
  const [metric, setMetric] = useState<MaterialMetric>('rating');
  const track = useRef<HTMLOListElement>(null);
  const top = useMemo(
    () =>
      rankMaterials(films, {
        metric,
        category: 'Все',
        limit: 10,
      }).materials.slice(0, 5),
    [films, metric],
  );
  const fullUrl = materialTopUrl({ metric, category: 'Все', limit: 10 });
  const navigate = (event: MouseEvent<HTMLAnchorElement>, url: string) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey
    )
      return;
    event.preventDefault();
    go(url);
  };
  useLayoutEffect(() => {
    track.current?.scrollTo({ left: 0, behavior: 'instant' });
  }, [metric]);
  const select = (value: MaterialMetric) => {
    setMetric(value);
  };
  const shift = (direction: number) => {
    const list = track.current;
    if (!list) return;
    const width =
      list.querySelector('li')?.getBoundingClientRect().width || 200;
    list.scrollBy({
      left: direction * (width + 18),
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  };
  const number = (value: number) =>
    value.toLocaleString(en ? 'en-US' : 'ru-RU');
  return (
    <section
      className="home-five home-section"
      aria-label={en ? 'Community top 5' : 'Топ-5 сообщества'}
    >
      <header className="home-five-heading">
        <div>
          <span className="eyebrow">
            {en ? 'CHOSEN BY THE COMMUNITY' : 'ВЫБОР КИНОСООБЩЕСТВА'}
          </span>
          <h2>
            {en ? 'Five reasons' : 'Пять поводов'}{' '}
            <em>{en ? 'to watch.' : 'посмотреть.'}</em>
          </h2>
        </div>
        <a
          className="home-five-full"
          href={fullUrl}
          onClick={(event) => navigate(event, fullUrl)}
        >
          {en ? 'Full top 10' : 'Весь топ-10'}
          <ArrowRight size={16} />
        </a>
      </header>
      <div className="home-five-toolbar">
        <div
          className="home-five-filters"
          role="group"
          aria-label={en ? 'Home top criterion' : 'Критерий топ-5'}
        >
          <button
            type="button"
            aria-pressed={metric === 'rating'}
            onClick={() => select('rating')}
          >
            <Star size={15} />
            {en ? 'By rating' : 'По рейтингу'}
          </button>
          <button
            type="button"
            aria-pressed={metric === 'views'}
            onClick={() => select('views')}
          >
            <Eye size={16} />
            {en ? 'By views' : 'По просмотрам'}
          </button>
          <button
            type="button"
            aria-pressed={metric === 'favorites'}
            onClick={() => select('favorites')}
          >
            <Heart size={15} />
            {en ? 'Most favorited' : 'По любимому'}
          </button>
        </div>
        <div
          className="home-five-arrows"
          role="group"
          aria-label={en ? 'Scroll the top' : 'Прокрутка топа'}
        >
          <button
            type="button"
            aria-label={en ? 'Previous posters' : 'Предыдущие постеры'}
            onClick={() => shift(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label={en ? 'Next posters' : 'Следующие постеры'}
            onClick={() => shift(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <p className="home-five-method" role="status">
        {metric === 'rating'
          ? en
            ? 'Highest average ratings from our viewers.'
            : 'Самые высокие средние оценки зрителей сайта.'
          : metric === 'views'
            ? en
              ? 'Most visited title pages, all time — not watched check-ins.'
              : 'Чаще всего открывают на сайте — по посещениям страниц, не отметкам просмотра.'
            : en
              ? 'Most users have these titles in their favorites.'
              : 'Чаще всего добавляют в любимое — по числу пользователей.'}
      </p>
      {top.length ? (
        <ol
          ref={track}
          className="home-five-track"
          tabIndex={0}
          aria-label={
            en
              ? 'Top five posters; scroll horizontally'
              : 'Постеры топ-5; доступна горизонтальная прокрутка'
          }
        >
          {top.map((film, index) => (
            <li key={film.id}>
              <a
                className="home-five-card cinema-card"
                href={`/movie/${film.id}`}
                aria-label={`${en ? 'Place' : 'Место'} ${index + 1}. ${film.title}. ${film.year}, ${film.category}. ${metric === 'rating' ? `${en ? 'Rating' : 'Рейтинг'} ${formatFilmRating(film)}` : metric === 'views' ? `${en ? 'Page visits' : 'Посещения страницы'} ${number(film.views || 0)}` : `${en ? 'Users who favorited' : 'Добавили в любимое'} ${number(film.favoriteCount || 0)}`}${film.ageRating ? `. ${film.ageRating}` : ''}`}
                onClick={(event) => navigate(event, `/movie/${film.id}`)}
              >
                <span className="home-five-art">
                  <span className="home-five-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <Cover key={`${film.id}:${film.poster}`} film={film} />
                  <span className="home-five-score cinema-rating">
                    {metric === 'rating' ? (
                      <>
                        <Star size={11} fill="currentColor" />
                        {formatFilmRating(film)}
                      </>
                    ) : metric === 'views' ? (
                      <>
                        <Eye size={12} />
                        {number(film.views || 0)}
                      </>
                    ) : (
                      <>
                        <Heart size={11} fill="currentColor" />
                        {number(film.favoriteCount || 0)}
                      </>
                    )}
                  </span>
                </span>
                <span className="home-five-caption">
                  <strong>{film.title}</strong>
                  <small>
                    {film.year} · {film.category}
                  </small>
                </span>
              </a>
            </li>
          ))}
        </ol>
      ) : (
        <div className="home-five-empty">
          <FilmIcon size={26} />
          <p>
            {en
              ? 'This top is still waiting for its first audience signals.'
              : 'Этот топ пока ждёт первых зрительских действий.'}
          </p>
          <button type="button" onClick={() => go('/catalog')}>
            {en ? 'Explore catalog' : 'Открыть каталог'}
            <ArrowRight size={15} />
          </button>
        </div>
      )}
    </section>
  );
}
