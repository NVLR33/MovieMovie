"use client";

import { useState } from "react";
import { ArrowUpRight, ChevronRight, Film } from "lucide-react";
import type { Film as Material } from "@/lib/data";
import MaterialCover from "./material-cover";

/** A manual entry into the current result set, never an unrelated recommendation. */
export default function CatalogScreening({
  films,
  open,
  en = false,
}: {
  films: Material[];
  open: (href: string) => void;
  en?: boolean;
}) {
  const [cursor, setCursor] = useState(0);
  const index = cursor % Math.max(films.length, 1),
    film = films[index];
  if (!film) return null;
  return (
    <section
      className="catalog-screening"
      aria-label={
        en ? "A title from your selection" : "История из твоей выборки"
      }
    >
      <MaterialCover
        film={film}
        preview={false}
        className="catalog-screening-cover"
      />
      <div className="catalog-screening-copy">
        <span className="eyebrow">
          <Film size={13} />
          {en ? "A WAY INTO YOUR SELECTION" : "ТОЧКА ВХОДА В ТВОЮ ВЫБОРКУ"}
        </span>
        <h2>{film.title}</h2>
        <p>
          {film.year}
          <span> / </span>
          {film.category}
          <span> / </span>
          {film.genre}
        </p>
        <a
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
            open(`/movie/${film.id}`);
          }}
        >
          {en ? "Take a closer look" : "Быстрый взгляд"}
          <ArrowUpRight size={16} />
        </a>
      </div>
      <div className="catalog-screening-step">
        <span aria-live="polite" aria-atomic="true">
          {String(index + 1).padStart(2, "0")}
          <small> / {films.length}</small>
        </span>
        <button
          type="button"
          disabled={films.length < 2}
          aria-label={
            en ? "Next title in selection" : "Следующая история в выборке"
          }
          onClick={() => setCursor((value) => value + 1)}
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </section>
  );
}
