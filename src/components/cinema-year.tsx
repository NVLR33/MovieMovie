"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Clapperboard,
  Clock3,
  Film,
  Heart,
  Play,
  RotateCcw,
  Share2,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import WrappedExperience, { type WrappedData } from "./wrapped-experience";
import WrappedShare from "./wrapped-share";
import MaterialCover from "./material-cover";
import { CINEMA_YEAR_CHAPTERS, cinemaYears } from "@/lib/cinema-year";

const icons = [
  Clapperboard,
  Clock3,
  Film,
  Sparkles,
  Star,
  Heart,
  CalendarDays,
  Trophy,
  BookOpen,
];
const number = (value: number) => value.toLocaleString("ru-RU");
export default function CinemaYear({ go }: { go: (path: string) => void }) {
  const [year, setYear] = useState(() => new Date().getUTCFullYear());
  const [result, setResult] = useState<{
    year: number;
    data: WrappedData;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [story, setStory] = useState<number | null>(null);
  const [share, setShare] = useState<{
    data: WrappedData;
    step: number;
  } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const years = cinemaYears(new Date().getUTCFullYear());
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/wrapped?year=${year}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 401
              ? "Войди в аккаунт, чтобы увидеть свой киногод."
              : "Не удалось собрать итоги. Попробуй ещё раз.",
          );
        const data: WrappedData = await response.json();
        if (!controller.signal.aborted) {
          setResult({ year, data });
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Ошибка соединения");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [year, revision]);
  const selectYear = (value: number) => {
    setYear(value);
    setLoading(true);
    setError("");
    setResult(null);
  };
  const data = result?.year === year ? result.data : null;
  return (
    <section className="cinema-year" aria-label="Мой киногод">
      <nav className="year-breadcrumb" aria-label="Личное кино">
        <Link
          href="/profile"
          onClick={(e) => {
            e.preventDefault();
            go("/profile");
          }}
        >
          <BookOpen size={15} /> Кинодневник
        </Link>
        <span>/</span>
        <span aria-current="page">Мой киногод</span>
      </nav>
      <header className="year-heading">
        <div>
          <span className="eyebrow">ЛИЧНАЯ РЕТРОСПЕКТИВА</span>
          <h1 ref={heading} tabIndex={-1}>
            У этого года <em>твой почерк.</em>
          </h1>
          <p>
            Истории, которым ты подарил время. Моменты, которые остались с
            тобой.
          </p>
        </div>
        <label className="year-picker">
          <CalendarDays size={18} />
          Год
          <select
            aria-label="Год итогов"
            value={year}
            onChange={(e) => selectYear(Number(e.target.value))}
          >
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </header>
      {loading ? (
        <div className="year-state" role="status">
          <Clapperboard size={32} />
          <h2>Собираем твой {year}-й…</h2>
          <p>Только отмеченные просмотры и твои впечатления.</p>
        </div>
      ) : error ? (
        <div className="year-state" role="alert">
          <h2>Монтажу нужна ещё одна попытка</h2>
          <p>{error}</p>
          <button
            className="outline-btn"
            onClick={() => {
              setLoading(true);
              setError("");
              setRevision((v) => v + 1);
            }}
          >
            <RotateCcw size={16} />
            Повторить загрузку
          </button>
        </div>
      ) : data && !data.hasData ? (
        <div className="year-empty">
          <div className="year-empty-frame">
            <Film size={58} />
            <span>{year}</span>
          </div>
          <div>
            <span className="eyebrow">ЧИСТЫЙ ЛИСТ · НЕ ПУСТАЯ ИСТОРИЯ</span>
            <h2>Этот год пока за кадром.</h2>
            <p>
              В {year} году нет отмеченных просмотров. Выбери другой год или
              открой каталог — итоги появятся из твоей настоящей истории, а не
              случайных рекомендаций.
            </p>
            <button className="primary-btn" onClick={() => go("/catalog")}>
              Открыть каталог <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        data && (
          <>
            <div className="year-main-grid">
              <article className="year-premiere">
                <div className="year-premiere-top">
                  <span>
                    <Clapperboard size={16} /> moviemovie / РЕТРОСПЕКТИВА
                  </span>
                  <b>{year}</b>
                </div>
                <div className="year-premiere-copy">
                  <span className="eyebrow">В ГЛАВНОЙ РОЛИ — ТЫ</span>
                  <h2>
                    Это было <em>кино.</em>
                  </h2>
                  <p className="year-username">@{data.username}</p>
                  <p>
                    Девять глав о твоём годе. Без спешки, автопереключения и
                    обязательной публикации.
                  </p>
                  <div className="year-actions">
                    <button className="primary-btn" onClick={() => setStory(0)}>
                      <Play size={17} />
                      Смотреть мой киногод
                    </button>
                    <button
                      className="outline-btn"
                      onClick={() => setShare({ data, step: 8 })}
                    >
                      <Share2 size={16} />
                      Создать карточку
                    </button>
                  </div>
                </div>
                <div
                  className="year-filmstrip"
                  aria-label="Материалы из твоего года"
                >
                  {data.posters.slice(0, 5).map((movie) => (
                    <MaterialCover
                      key={movie.id}
                      film={movie}
                      alt={movie.title}
                      badges={false}
                      preview={false}
                    />
                  ))}
                </div>
                <footer>
                  <span>Личная история · {year}</span>
                  <span>
                    9 глав <ArrowUpRight size={14} />
                  </span>
                </footer>
              </article>
              <aside className="year-summary" aria-label="Год в цифрах">
                <span className="eyebrow">НЕСКОЛЬКО ТОЧЕК ОПОРЫ</span>
                <h2>
                  Твой год.
                  <br />В нескольких кадрах.
                </h2>
                <dl>
                  <div>
                    <dt>
                      <Film size={16} />
                      Просмотры
                    </dt>
                    <dd>{number(data.watches)}</dd>
                    <small>
                      {number(data.uniqueMovies)} уникальных материалов
                    </small>
                  </div>
                  <div>
                    <dt>
                      <Clock3 size={16} />
                      Часов кино
                    </dt>
                    <dd>{number(data.hours)}</dd>
                    <small>
                      {number(data.minutes)} минут по хронометражу каталога
                    </small>
                  </div>
                  <div>
                    <dt>
                      <Star size={16} />
                      Средняя оценка
                    </dt>
                    <dd>
                      {data.averageRating === null
                        ? "—"
                        : number(data.averageRating)}
                    </dd>
                    <small>
                      {data.ratingsCount
                        ? `Оценено материалов: ${number(data.ratingsCount)}`
                        : "Нет оценок у материалов этого года"}
                    </small>
                  </div>
                </dl>
                <p>
                  Просмотры отобраны по датам UTC. Оценки — текущие, у
                  материалов, просмотренных в выбранном году. Это не журнал дат
                  выставления оценок.
                </p>
              </aside>
            </div>
            <section className="year-chapters" aria-label="Главы киногода">
              <header>
                <div>
                  <span className="eyebrow">ТВОЙ ГОД, В ТВОЁМ ПОРЯДКЕ</span>
                  <h2>Начни с того, что откликается.</h2>
                </div>
                <p>Любую главу можно открыть отдельно.</p>
              </header>
              <div className="year-chapter-grid">
                {CINEMA_YEAR_CHAPTERS.map((chapter, index) => {
                  const Icon = icons[index];
                  return (
                    <button
                      key={chapter.icon}
                      className="year-chapter"
                      onClick={() => setStory(index)}
                    >
                      <span className="year-chapter-top">
                        <Icon size={20} />
                        <small>{String(index + 1).padStart(2, "0")}</small>
                      </span>
                      <b>{chapter.title}</b>
                      <span>{chapter.note}</span>
                      <ArrowUpRight size={16} />
                    </button>
                  );
                })}
              </div>
            </section>
            <footer className="year-footnote">
              <Heart size={17} />
              <p>
                Здесь нет гонки за количеством. Только твои отмеченные истории.
                Просмотр итогов и создание карточки не добавляют просмотры, XP
                или попкорн.
              </p>
            </footer>
          </>
        )
      )}
      {story !== null && (
        <WrappedExperience
          initialYear={year}
          initialSlide={story}
          onYearChange={selectYear}
          onClose={() => {
            setStory(null);
            requestAnimationFrame(() => {
              // A year change replaces the launch card. Keep keyboard users in the overview.
              if (
                document.activeElement === document.body ||
                document.activeElement === document.documentElement
              )
                heading.current?.focus({ preventScroll: true });
            });
          }}
          onShare={(data, step) => setShare({ data, step })}
        />
      )}
      {share && (
        <WrappedShare
          data={share.data}
          initialSlide={share.step}
          onClose={() => setShare(null)}
        />
      )}
    </section>
  );
}
