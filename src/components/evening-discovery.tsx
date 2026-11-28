"use client";
import { useId, useMemo, useState, type MouseEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Brain,
  Heart,
  Popcorn,
  RefreshCw,
  Sparkles,
  Star,
} from "lucide-react";
import type { Film } from "@/lib/data";
import { matchesCatalogMood, type CatalogMood } from "@/lib/catalog-moods";
import {
  EVENING_MOODS,
  eveningCandidates,
  eveningCatalogUrl,
} from "@/lib/evening-discovery";
import { formatFilmRating } from "@/lib/rating-display";
import MaterialCover from "./material-cover";

const icons = { popcorn: Popcorn, mind: Brain, tears: Heart, grip: AudioLines };
export default function EveningDiscovery({
  films,
  go,
  en = false,
}: {
  films: readonly Film[];
  go: (url: string) => void;
  en?: boolean;
}) {
  const [mood, setMood] = useState<CatalogMood>("all");
  const [cursor, setCursor] = useState(0);
  const heading = useId();
  const candidates = useMemo(
    () => eveningCandidates(films, mood),
    [films, mood],
  );
  const counts = useMemo(
    () =>
      new Map(
        EVENING_MOODS.map((item) => [
          item.id,
          films.filter((film) => matchesCatalogMood(film, item.id)).length,
        ]),
      ),
    [films],
  );
  const film = candidates.length
    ? candidates[cursor % candidates.length]
    : undefined;
  const select = (value: CatalogMood) => {
    setMood(value);
    setCursor(0);
  };
  const navigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
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
    <section className="evening-discovery" aria-labelledby={heading}>
      <header className="evening-heading">
        <span className="eyebrow">
          <Sparkles size={13} />
          {en ? "TUNE INTO A STORY" : "НАСТРОЙСЯ НА ИСТОРИЮ"}
        </span>
        <span className="evening-orbit" aria-hidden="true">
          ✳
        </span>
      </header>
      <div className="evening-intro">
        <h2 id={heading}>
          {en ? (
            <>
              Your mood.
              <br />
              <em>Your movie.</em>
            </>
          ) : (
            <>
              Твоё настроение.
              <br />
              <em>Твоё кино.</em>
            </>
          )}
        </h2>
        <p>
          {en
            ? "Pick a feeling. Find a story in the catalog."
            : "Выбери ощущение — найдём историю в каталоге."}
        </p>
      </div>
      <div
        className="evening-moods"
        role="group"
        aria-label={en ? "Choose a mood" : "Выбрать настроение"}
      >
        {EVENING_MOODS.map((item) => {
          const Icon = icons[item.id];
          return (
            <button
              type="button"
              key={item.id}
              aria-pressed={mood === item.id}
              onClick={() => select(mood === item.id ? "all" : item.id)}
              title={en ? item.noteEn : item.note}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{en ? item.en : item.ru}</span>
              <small aria-hidden="true">{counts.get(item.id)}</small>
            </button>
          );
        })}
      </div>
      <div className="evening-result-heading">
        <span role="status" aria-live="polite" aria-atomic="true">
          {en
            ? `${candidates.length} titles · ${mood === "all" ? "any mood" : "your selection"}`
            : `${candidates.length} в каталоге · ${mood === "all" ? "любое настроение" : "по настроению"}`}
        </span>
        {mood !== "all" && (
          <button type="button" onClick={() => select("all")}>
            {en ? "Reset" : "Сбросить"}
          </button>
        )}
      </div>
      {film ? (
        <div className="evening-result" data-movie-id={film.id}>
          <a
            className="evening-film"
            href={`/movie/${film.id}`}
            onClick={(event) => navigate(event, `/movie/${film.id}`)}
            aria-label={
              en ? `Discover ${film.title}` : `Подробнее: ${film.title}`
            }
          >
            <MaterialCover film={film} className="evening-poster" />
            <div className="evening-film-copy" key={film.id}>
              <small>
                {film.year} · {film.category}
              </small>
              <h3>{film.title}</h3>
              <span className="evening-film-score">
                <Star size={12} aria-hidden="true" />
                {formatFilmRating(film)}
              </span>
              <span className="evening-film-open">
                {en ? "Discover the story" : "Открыть историю"}
                <ArrowUpRight size={14} />
              </span>
            </div>
          </a>
          <button
            type="button"
            className="evening-next"
            disabled={candidates.length < 2}
            onClick={() =>
              setCursor((value) => (value + 1) % candidates.length)
            }
          >
            <RefreshCw size={13} />
            {en ? "Another story" : "Ещё вариант"}
          </button>
        </div>
      ) : (
        <div className="evening-empty">
          <Sparkles size={22} />
          <p>
            {en
              ? "No titles for this mood yet. Try another feeling."
              : "Для этого настроения пока нет историй. Попробуй другое."}
          </p>
          <button type="button" onClick={() => select("all")}>
            {en ? "Show all titles" : "Показать всё"}
          </button>
        </div>
      )}
      <a
        className="evening-catalog"
        href={eveningCatalogUrl(mood)}
        onClick={(event) => navigate(event, eveningCatalogUrl(mood))}
      >
        {en ? "Explore the catalog" : "Продолжить в каталоге"}
        <ArrowRight size={16} />
      </a>
    </section>
  );
}
