"use client";
import { trapDialogFocus } from "@/lib/dialog-focus";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Bookmark, Heart, Play, Star, X } from "lucide-react";
import type { Film } from "@/lib/data";
import { formatFilmRating } from "@/lib/rating-display";
import { trailerSource } from "@/lib/trailers";
import MaterialCover from "./material-cover";

const MARKER = "moviemovieQuickView";
const locationKey = () => location.pathname + location.search;
function readMarker() {
  const marker = history.state?.[MARKER];
  return marker?.path === locationKey() &&
    Number.isSafeInteger(marker.id) &&
    marker.id > 0
    ? (marker.id as number)
    : null;
}
export function useMovieQuickView() {
  const [id, setId] = useState<number | null>(null);
  const background = useRef<{ x: number; y: number; path: string } | null>(
    null,
  );
  useEffect(() => {
    // A reload loads the real background route, not an orphaned modal history entry.
    if (history.state?.[MARKER]) {
      const state = { ...history.state };
      delete state[MARKER];
      history.replaceState(state, "");
    }
    let frame = 0;
    const pop = () => {
      const next = readMarker(),
        marker = history.state?.[MARKER];
      if (next && Number.isFinite(marker.x) && Number.isFinite(marker.y))
        background.current = { x: marker.x, y: marker.y, path: marker.path };
      setId(next);
      // Next/browser history restoration runs in the same turn. Restore the
      // background after that and after the native modal unlocks the document.
      const position = background.current;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (position && locationKey() === position.path)
            window.scrollTo({
              left: position.x,
              top: position.y,
              behavior: "instant",
            });
        });
      });
    };
    window.addEventListener("popstate", pop);
    return () => {
      window.removeEventListener("popstate", pop);
      cancelAnimationFrame(frame);
    };
  }, []);
  const discard = () => {
    background.current = null;
    if (history.state?.[MARKER]) {
      const state = { ...history.state };
      delete state[MARKER];
      history.replaceState(state, "");
    }
    setId(null);
  };
  return {
    id,
    open(next: number) {
      if (!readMarker())
        background.current = { x: scrollX, y: scrollY, path: locationKey() };
      const state = {
        ...history.state,
        [MARKER]: { id: next, ...background.current, path: locationKey() },
      };
      if (readMarker()) history.replaceState(state, "");
      else history.pushState(state, "");
      setId(next);
    },
    close() {
      setId(null);
      if (readMarker()) history.back();
    },
    discard,
  };
}
export default function MovieQuickView({
  film,
  saved,
  favorite,
  signedIn,
  action,
  auth,
  close,
  full,
  en = false,
}: {
  film: Film | undefined;
  saved: boolean;
  favorite: boolean;
  signedIn: boolean;
  action: (payload: Record<string, unknown>) => Promise<boolean>;
  auth: () => void;
  close: () => void;
  full: () => void;
  en?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    title = useId();
  const [trailer, setTrailer] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current!,
      previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    // Stop any muted cover preview when its background becomes inert.
    window.dispatchEvent(new Event("mg-trailer-preview"));
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
      else
        document.getElementById("main-content")?.focus({ preventScroll: true });
    };
  }, []);
  const mutate = async (kind: "bookmark" | "favorite") => {
    if (!signedIn) {
      auth();
      return;
    }
    if (busy || !film) return;
    setBusy(true);
    setError("");
    try {
      const ok = await action({
        action: kind === "favorite" && favorite ? "unfavorite" : kind,
        movieId: film.id,
      });
      if (!ok)
        setError(
          en
            ? "Could not save. Please try again."
            : "Не удалось сохранить. Попробуй ещё раз.",
        );
    } catch {
      setError(
        en
          ? "Connection error. Please try again."
          : "Ошибка соединения. Попробуй ещё раз.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <dialog
        ref={dialog}
        className="movie-quick-view"
        onKeyDown={trapDialogFocus}
        aria-labelledby={title}
        onCancel={(event) => {
          event.preventDefault();
          if (trailer) setTrailer(false);
          else close();
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const r = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            close();
        }}
      >
        <button
          type="button"
          className="quick-view-close"
          autoFocus
          aria-label={en ? "Close preview" : "Закрыть быстрый просмотр"}
          onClick={close}
        >
          <X size={22} />
        </button>
        {film ? (
          <>
            <div
              className="quick-view-art"
              style={{
                backgroundImage: `linear-gradient(0deg,#0b0e12 0%,#0b0e1226 85%),url(${JSON.stringify(film.backdrop || film.poster)})`,
              }}
            >
              <span>moviemovie / {en ? "QUICK LOOK" : "БЫСТРЫЙ ВЗГЛЯД"}</span>
            </div>
            <div className="quick-view-body">
              <MaterialCover film={film} className="quick-view-poster" />
              <div className="quick-view-copy">
                <div className="quick-view-meta">
                  <span>{film.category}</span>
                  <span>{film.year}</span>
                  {film.duration > 0 && (
                    <span>
                      {film.duration} {en ? "min" : "мин"}
                    </span>
                  )}
                  <b>
                    <Star size={14} />
                    {formatFilmRating(film)}
                  </b>
                </div>
                <h2 id={title}>{film.title}</h2>
                {film.originalTitle && film.originalTitle !== film.title && (
                  <small className="quick-view-original">
                    {film.originalTitle}
                  </small>
                )}
                <p className="quick-view-description">
                  {film.description ||
                    (en
                      ? "More about this title on its full page."
                      : "Подробнее об этой истории — в полной карточке.")}
                </p>
                <div className="quick-view-genres">
                  {film.genre
                    .split(",")
                    .map((g) => g.trim())
                    .filter(Boolean)
                    .slice(0, 4)
                    .map((g) => (
                      <span key={g}>{g}</span>
                    ))}
                </div>
              </div>
              <div className="quick-view-actions">
                <a
                  className="primary-btn"
                  href={`/movie/${film.id}`}
                  onClick={(event) => {
                    if (
                      event.button !== 0 ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return;
                    event.preventDefault();
                    full();
                  }}
                >
                  {en ? "Full movie page" : "Полная карточка"}
                  <ArrowUpRight size={17} />
                </a>
                {trailerSource(film.trailerUrl) && (
                  <button
                    type="button"
                    className="outline-btn"
                    onClick={() => setTrailer(true)}
                  >
                    <Play size={16} />
                    {en ? "Trailer" : "Трейлер"}
                  </button>
                )}
                <button
                  type="button"
                  className="quick-save"
                  data-saved={saved}
                  aria-pressed={saved}
                  disabled={busy}
                  onClick={() => void mutate("bookmark")}
                >
                  <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
                  {saved
                    ? en
                      ? "Saved"
                      : "В желаемом"
                    : en
                      ? "Watch later"
                      : "Буду смотреть"}
                </button>
                <button
                  type="button"
                  className="quick-favorite"
                  aria-pressed={favorite}
                  disabled={busy}
                  onClick={() => void mutate("favorite")}
                >
                  <Heart size={17} fill={favorite ? "currentColor" : "none"} />
                  {favorite
                    ? en
                      ? "Favorite"
                      : "В любимом"
                    : en
                      ? "Favorite"
                      : "В любимое"}
                </button>
              </div>
              {trailer && film.trailerUrl && (
                <QuickTrailer
                  url={film.trailerUrl}
                  title={film.title}
                  en={en}
                  close={() => setTrailer(false)}
                />
              )}
              {error && (
                <p className="quick-view-error" role="alert">
                  {error}
                </p>
              )}
              <p className="quick-view-footnote">
                {en
                  ? "Close this preview to return to the same place in your feed."
                  : "Закрой просмотр — и вернёшься на то же место в ленте."}
              </p>
            </div>
          </>
        ) : (
          <div className="quick-view-body">
            <h2 id={title}>
              {en ? "Title unavailable" : "История недоступна"}
            </h2>
            <p>
              {en
                ? "The catalog may have changed. Close this preview to keep exploring."
                : "Каталог мог измениться. Закрой просмотр и продолжай открывать кино."}
            </p>
          </div>
        )}
      </dialog>
    </>
  );
}

function QuickTrailer({
  url,
  title,
  en,
  close,
}: {
  url: string;
  title: string;
  en: boolean;
  close: () => void;
}) {
  const source = trailerSource(url),
    ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector("button")?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  if (!source) return null;
  return (
    <section
      className="quick-view-trailer"
      ref={ref}
      aria-label={`${en ? "Trailer" : "Трейлер"}: ${title}`}
    >
      <button type="button" onClick={close}>
        <X size={16} />
        {en ? "Close trailer" : "Закрыть трейлер"}
      </button>
      {source.kind === "video" ? (
        <video src={source.url} controls playsInline preload="metadata" />
      ) : (
        <iframe
          title={`${en ? "Trailer" : "Трейлер"}: ${title}`}
          src={source.url}
          allow="fullscreen; picture-in-picture"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="no-referrer"
        />
      )}
    </section>
  );
}
