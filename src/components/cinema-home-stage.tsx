"use client";
import Link from "next/link";
import { useMemo, useState, type MouseEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Compass,
  Globe2,
  Layers3,
  Shuffle,
  Star,
  Users,
} from "lucide-react";
import type { Film } from "@/lib/data";
import { formatFilmRating } from "@/lib/rating-display";
import MaterialCover from "./material-cover";
import HeroStats from "./hero-stats";
import EveningDiscovery from "./evening-discovery";

export default function CinemaHomeStage({
  films,
  go,
  roulette,
  en = false,
  username,
  peopleCount,
  watchedCount,
  savedIds,
}: {
  films: Film[];
  go: (url: string) => void;
  roulette: () => void;
  en?: boolean;
  username?: string;
  peopleCount: number;
  watchedCount: number | null;
  savedIds: number[];
}) {
  const stories = useMemo(
    () =>
      [
        ...films.filter((f) => f.featured),
        ...films.filter((f) => !f.featured),
      ].slice(0, 4),
    [films],
  );
  const [index, setIndex] = useState(0);
  const film = stories[index % Math.max(1, stories.length)];
  const saved = useMemo(
    () =>
      savedIds
        .map((id) => films.find((f) => f.id === id))
        .filter((f): f is Film => !!f)
        .slice(0, 3),
    [films, savedIds],
  );
  const follow = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    go(href);
  };
  return (
    <>
      {film ? (
        <section
          className="spotlight-stage"
          aria-label={en ? "In the spotlight" : "В центре внимания"}
          style={{
            backgroundImage: `linear-gradient(90deg,#080b10ed 0%,#080b1080 48%,#080b101a 100%),linear-gradient(0deg,#080b10 0%,transparent 75%),url(${JSON.stringify(film.backdrop || film.poster)})`,
          }}
        >
          <div className="spotlight-top">
            <span>
              <i />
              {en
                ? "CINEMA OUTSIDE THE ORDINARY"
                : "КИНО ЗА РАМКАМИ ПРИВЫЧНОГО"}
            </span>
            <span>moviemovie / selection</span>
          </div>
          <div className="spotlight-layout">
            <div className="spotlight-story">
              <div className="spotlight-edition">
                <span>
                  {String((index % stories.length) + 1).padStart(2, "0")}
                </span>
                <b>{en ? "TODAY IN FOCUS" : "СЕГОДНЯ В ФОКУСЕ"}</b>
              </div>
              <div className="spotlight-meta">
                <b>
                  <Star size={14} />
                  {formatFilmRating(film)}
                </b>
                <span>{film.year}</span>
                <span>{film.category}</span>
              </div>
              <h1>{film.title}</h1>
              <p>{film.description}</p>
              <div className="spotlight-actions">
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => go(`/movie/${film.id}`)}
                >
                  {en ? "Take a closer look" : "Быстрый взгляд"}
                  <ArrowUpRight size={18} />
                </button>
                <button
                  type="button"
                  className="spotlight-random"
                  aria-label={en ? "Spin roulette" : "Крутить рулетку"}
                  onClick={roulette}
                >
                  <Shuffle size={17} />
                  {en ? "Surprise me" : "Удиви меня"}
                </button>
              </div>
            </div>
            <div className="spotlight-reel">
              <header>
                <span>{en ? "CHANGE THE PERSPECTIVE" : "СМЕНИТЬ РАКУРС"}</span>
                <div>
                  <button
                    type="button"
                    aria-label={
                      en ? "Previous featured title" : "Предыдущая история"
                    }
                    disabled={stories.length < 2}
                    onClick={() =>
                      setIndex((i) => (i - 1 + stories.length) % stories.length)
                    }
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    type="button"
                    aria-label={
                      en ? "Next featured title" : "Следующая история"
                    }
                    disabled={stories.length < 2}
                    onClick={() => setIndex((i) => (i + 1) % stories.length)}
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </header>
              <div className="spotlight-posters">
                {stories.slice(0, 4).map((story, i) => (
                  <button
                    type="button"
                    key={story.id}
                    aria-label={`${en ? "Feature" : "В фокус"}: ${story.title}`}
                    aria-pressed={film.id === story.id}
                    onClick={() => setIndex(i)}
                  >
                    <MaterialCover film={story} className="spotlight-poster" />
                    <span>{story.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="spotlight-bottom">
            <HeroStats
              films={films}
              peopleCount={peopleCount}
              watchesCount={watchedCount}
              en={en}
            />
            <span>
              {en
                ? "NOT JUST A CATALOG. A WAY INTO CINEMA."
                : "НЕ ПРОСТО КАТАЛОГ. ТВОЙ ВХОД В КИНО."}
            </span>
          </div>
        </section>
      ) : (
        <section className="spotlight-empty">
          <Compass size={36} />
          <h1>
            {en
              ? "Every story starts somewhere."
              : "У каждой истории есть начало."}
          </h1>
          <p>
            {en
              ? "The catalog is taking shape. New discoveries will appear here."
              : "Каталог пока пуст. Здесь появятся новые истории и кинооткрытия."}
          </p>
        </section>
      )}
      <section
        className="cinema-launchpad"
        aria-label={en ? "Your next discovery" : "Твоё следующее открытие"}
      >
        <div className="launchpad-editorial">
          <span className="eyebrow">
            {username
              ? en
                ? "YOUR NEXT CHAPTER"
                : "ТВОЯ НОВАЯ ГЛАВА"
              : en
                ? "MORE THAN WATCHING"
                : "БОЛЬШЕ, ЧЕМ ПРОСМОТР"}
          </span>
          <h2>
            {username
              ? en
                ? "Good to see you,"
                : "С возвращением,"
              : en
                ? "Find it."
                : "Находи."}
            <br />
            <em>
              {username
                ? username
                : en
                  ? "Feel it. Keep it."
                  : "Чувствуй. Сохраняй."}
            </em>
          </h2>
          <p>
            {username
              ? en
                ? "Your watchlist is a starting point for the next great evening."
                : "Твоё запланированное кино — отправная точка для следующего вечера."
              : en
                ? "A story for tonight. A shelf of favorites. People who get your cinema."
                : "История на вечер. Полка любимого. Люди, с которыми ты на одной волне."}
          </p>
          <Link
            prefetch={false}
            href="/catalog"
            onClick={(e) => follow(e, "/catalog")}
          >
            {en ? "Discover the catalog" : "Исследовать каталог"}
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="launchpad-shelf">
          <header>
            <span className="eyebrow">
              <Bookmark size={13} />
              {username
                ? en
                  ? "ON YOUR RADAR"
                  : "У ТЕБЯ В ПЛАНАХ"
                : en
                  ? "YOUR CINEMA, CLOSE BY"
                  : "ТВОЁ КИНО РЯДОМ"}
            </span>
            <Link
              prefetch={false}
              href="/watchlist"
              aria-label={en ? "Open watchlist" : "Открыть желаемое"}
              onClick={(e) => follow(e, "/watchlist")}
            >
              <ArrowUpRight size={19} />
            </Link>
          </header>
          {username && saved.length > 0 ? (
            <>
              <div className="launchpad-saved">
                {saved.map((story) => (
                  <Link
                    prefetch={false}
                    key={story.id}
                    href={`/movie/${story.id}`}
                    onClick={(e) => follow(e, `/movie/${story.id}`)}
                    aria-label={story.title}
                  >
                    <MaterialCover film={story} className="launchpad-cover" />
                    <span>{story.title}</span>
                  </Link>
                ))}
              </div>
              <small>
                {en
                  ? "Saved by you. Ready when you are."
                  : "Сохранено тобой. Дождётся твоего вечера."}
              </small>
            </>
          ) : (
            <>
              <div className="launchpad-symbol" aria-hidden="true">
                <Layers3 size={52} />
              </div>
              <h3>
                {en
                  ? "Good stories deserve a place."
                  : "У хороших историй должно быть своё место."}
              </h3>
              <p>
                {en
                  ? "Keep a watchlist and favorites. Every collection starts with one film."
                  : "Собирай желаемое и любимое. Каждая коллекция начинается с одного фильма."}
              </p>
              <Link
                prefetch={false}
                className="launchpad-link"
                href="/watchlist"
                onClick={(e) => follow(e, "/watchlist")}
              >
                {en ? "My cinema" : "Моё кино"}
                <ArrowRight size={15} />
              </Link>
            </>
          )}
        </div>
        <div className="launchpad-paths">
          <Link
            prefetch={false}
            href="/world"
            onClick={(e) => follow(e, "/world")}
          >
            <Globe2 size={24} />
            <div>
              <small>{en ? "A DIFFERENT PERSPECTIVE" : "ДРУГОЙ РАКУРС"}</small>
              <h3>{en ? "Cinema without borders" : "Кино без границ"}</h3>
              <p>
                {en
                  ? "Explore stories through the world map."
                  : "Открывай истории через карту мира."}
              </p>
            </div>
            <ArrowUpRight size={19} />
          </Link>
          <Link
            prefetch={false}
            href="/collab"
            onClick={(e) => follow(e, "/collab")}
          >
            <Users size={24} />
            <div>
              <small>{en ? "BETTER TOGETHER" : "ВМЕСТЕ ИНТЕРЕСНЕЕ"}</small>
              <h3>{en ? "Find your people" : "Найди своих"}</h3>
              <p>
                {en
                  ? "Collections, discoveries and shared experiences."
                  : "Подборки, находки и общие впечатления."}
              </p>
            </div>
            <ArrowUpRight size={19} />
          </Link>
        </div>
      </section>
      <div className="cinema-mood-section">
        <div className="cinema-mood-caption">
          <span className="eyebrow">
            {en ? "START WITH A FEELING" : "НАЧНИ С ОЩУЩЕНИЯ"}
          </span>
          <h2>
            {en ? (
              <>
                What kind of
                <br />
                evening is this?
              </>
            ) : (
              <>
                Каким будет
                <br />
                этот вечер?
              </>
            )}
          </h2>
          <p>
            {en
              ? "No endless scrolling. Choose a mood and explore real titles from the catalog."
              : "Без бесконечного скролла. Выбери настроение и присмотрись к историям из каталога."}
          </p>
          <span className="cinema-mood-decoration" aria-hidden="true">
            ↗
          </span>
        </div>
        <EveningDiscovery films={films} go={go} en={en} />
      </div>
    </>
  );
}
