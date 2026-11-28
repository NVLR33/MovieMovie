"use client";

import JourneyNavigation from "./journey-navigation";
import { atlasDestinations } from "@/lib/cinema-journeys";
import MaterialCover from "./material-cover";
import { materialTone } from "@/lib/trailers";
import { useMemo, useState } from "react";
import {
  Globe2,
  MapPin,
  RotateCcw,
  ZoomIn,
  ArrowDown,
  ArrowUpRight,
  Compass,
} from "lucide-react";
import type { Film } from "@/lib/data";
import geography from "@/data/world-map.json";
import {
  allCountryCodes,
  buildCountryIndex,
  cinemaDensity,
  countryName,
  parseFilmCountries,
} from "@/lib/cinema-countries";

const LEGEND = ["0", "1–2", "3–5", "6–11", "12+"];
export default function WorldCinema({
  films,
  watchedIds,
  signedIn,
  go,
  auth,
  en = false,
  initialMode = "",
  initialCountry = "",
}: {
  films: Film[];
  watchedIds: ReadonlySet<number>;
  signedIn: boolean;
  go: (url: string) => void;
  auth: () => void;
  en?: boolean;
  initialMode?: string;
  initialCountry?: string;
}) {
  const [mode, setMode] = useState<"catalog" | "watched">(
    initialMode === "watched" && signedIn ? "watched" : "catalog",
  );
  const [selected, setSelected] = useState(
    initialCountry === "unknown" || allCountryCodes().includes(initialCountry)
      ? initialCountry
      : "",
  );
  const [hover, setHover] = useState("");
  const [zoom, setZoom] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");
  const [category, setCategory] = useState("Все");
  const [sort, setSort] = useState("rating");
  const [unseenOnly, setUnseenOnly] = useState(false);
  const [limit, setLimit] = useState(12);
  const source = useMemo(
    () =>
      films.filter(
        (f) =>
          (mode === "catalog" || watchedIds.has(f.id)) &&
          (category === "Все" || f.category === category) &&
          (!unseenOnly || !watchedIds.has(f.id)),
      ),
    [films, mode, watchedIds, category, unseenOnly],
  );
  const index = useMemo(() => buildCountryIndex(source), [source]);
  const watchedIndex = useMemo(
    () => buildCountryIndex(films.filter((f) => watchedIds.has(f.id))),
    [films, watchedIds],
  );
  const countryList = useMemo(
    () =>
      allCountryCodes()
        .filter(
          (code) =>
            !countryQuery.trim() ||
            `${countryName(code)} ${countryName(code, true)} ${code}`
              .toLowerCase()
              .includes(countryQuery.trim().toLowerCase()),
        )
        .sort((a, b) =>
          countryName(a, en).localeCompare(
            countryName(b, en),
            en ? "en" : "ru",
          ),
        ),
    [countryQuery, en],
  );
  const picked = geography.shapes.find((shape) => shape.code === selected);
  const [x0, y0, x1, y1] = picked?.bounds || [0, 0, 960, 480];
  const boxWidth = Math.max(40, x1 - x0 + 32),
    boxHeight = Math.max(30, y1 - y0 + 32);
  const viewBox =
    zoom && picked
      ? `${(x0 + x1) / 2 - Math.max(boxWidth, boxHeight * 2) / 2} ${(y0 + y1) / 2 - Math.max(boxHeight, boxWidth / 2) / 2} ${Math.max(boxWidth, boxHeight * 2)} ${Math.max(boxHeight, boxWidth / 2)}`
      : "0 0 960 480";
  const select = (code: string) => {
    setSelected(code);
    setHover("");
    setLimit(12);
    setZoom(false);
  };
  const results = [
    ...(selected === "unknown"
      ? index.unmapped
      : selected
        ? index.byCountry.get(selected) || []
        : source),
  ].sort((a, b) =>
    sort === "year"
      ? b.year - a.year
      : sort === "views"
        ? (b.views || 0) - (a.views || 0)
        : b.rating - a.rating || b.ratingCount - a.ratingCount || a.id - b.id,
  );
  const destinations = atlasDestinations(index);
  const pointed = hover || (selected !== "unknown" ? selected : "");
  return (
    <div className="world-cinema">
      <JourneyNavigation active="world" en={en} />
      <div className="atlas-editorial">
        <header>
          <span className="eyebrow">
            {en ? "DISCOVER / THE CINEMA ATLAS" : "ОТКРЫВАТЬ / КИНОАТЛАС"}
          </span>
          <h1>
            {en ? "A world of stories." : "Кино больше, чем"}
            <br />
            <em>{en ? "Your next destination." : "знакомые координаты."}</em>
          </h1>
          <p>
            {en
              ? "Travel through the catalog by production country. Switch to your own viewing map to see where you have already been."
              : "Отправная точка — страна производства. Открывай новые истории или переключись на карту своих просмотров."}
          </p>
          <a href="#atlas-workspace" className="atlas-jump">
            {en ? "Choose a destination" : "Выбрать направление"}
            <ArrowDown size={16} />
          </a>
        </header>{" "}
        <div className="world-stat-row">
          <div>
            <b>{index.byCountry.size}</b>
            <span>
              {en ? "countries in this selection" : "стран в текущей выборке"}
            </span>
          </div>
          <div>
            <b>{new Set(source.map((f) => f.id)).size}</b>
            <span>{en ? "unique titles" : "разных материалов"}</span>
          </div>
          <div>
            <b>{signedIn ? watchedIndex.byCountry.size : "—"}</b>
            <span>{en ? "countries you explored" : "стран ты уже открыл"}</span>
          </div>
        </div>
      </div>
      <section
        className="atlas-workspace"
        id="atlas-workspace"
        aria-label={en ? "Explore the atlas" : "Исследовать киноатлас"}
      >
        <div className="atlas-map-column">
          <div className="world-toolbar">
            <div
              className="world-mode"
              role="group"
              aria-label={en ? "Map mode" : "Режим карты"}
            >
              <button
                type="button"
                aria-pressed={mode === "catalog"}
                onClick={() => {
                  setMode("catalog");
                  setLimit(12);
                }}
              >
                {en ? "Catalog atlas" : "Карта каталога"}
              </button>
              <button
                type="button"
                aria-pressed={mode === "watched"}
                onClick={() => {
                  if (!signedIn) {
                    auth();
                    return;
                  }
                  setMode("watched");
                  setUnseenOnly(false);
                  setLimit(12);
                }}
              >
                {en ? "My viewing map" : "Мои открытия"}
              </button>
            </div>
            <select
              aria-label={en ? "Title category" : "Категория на карте"}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setLimit(12);
              }}
            >
              <option value="Все">
                {en ? "All categories" : "Все категории"}
              </option>
              {[...new Set(films.map((f) => f.category))].sort().map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            {signedIn && mode === "catalog" && (
              <label className="world-unseen">
                <input
                  type="checkbox"
                  checked={unseenOnly}
                  onChange={(e) => {
                    setUnseenOnly(e.target.checked);
                    setLimit(12);
                  }}
                />
                {en ? "Not watched yet" : "Ещё не смотрел"}
              </label>
            )}
          </div>
          <section
            className="world-map-panel"
            aria-label={en ? "World cinema map" : "Мировая карта кино"}
          >
            <div className="world-map-info" role="status">
              <MapPin size={15} />
              <b>
                {pointed
                  ? countryName(pointed, en)
                  : en
                    ? "Choose a country on the map"
                    : "Выбери страну на карте"}
              </b>
              <span>
                {pointed
                  ? `${index.byCountry.get(pointed)?.length || 0} ${en ? "titles" : "материалов"}`
                  : en
                    ? "Color = number of titles"
                    : "Цвет = количество материалов"}
              </span>
            </div>
            <svg
              viewBox={viewBox}
              className="world-map-svg"
              onBlur={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null,
                  )
                )
                  setHover("");
              }}
              role="group"
              aria-label={
                en
                  ? "Countries; also available in the selector below"
                  : "Страны мира; доступны также в списке ниже"
              }
            >
              {geography.shapes.map((shape, i) => {
                const count = shape.code
                  ? index.byCountry.get(shape.code)?.length || 0
                  : 0;
                return (
                  <path
                    key={`${shape.id}-${i}`}
                    d={shape.path}
                    className={`world-country density-${cinemaDensity(count)} ${shape.code && selected === shape.code ? "is-selected" : ""}`}
                    data-country={shape.code || undefined}
                    role={shape.code ? "button" : undefined}
                    tabIndex={
                      shape.code &&
                      (shape.code === selected ||
                        (!selected && shape.code === "RU"))
                        ? 0
                        : -1
                    }
                    aria-label={
                      shape.code
                        ? `${countryName(shape.code, en)}: ${count}`
                        : shape.name
                    }
                    aria-pressed={
                      shape.code ? selected === shape.code : undefined
                    }
                    onMouseEnter={() => setHover(shape.code || "")}
                    onMouseLeave={() => setHover("")}
                    onFocus={() => setHover(shape.code || "")}
                    onClick={() => shape.code && select(shape.code)}
                    onKeyDown={(event) => {
                      if (!shape.code) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        select(shape.code);
                      }
                      if (
                        [
                          "ArrowRight",
                          "ArrowLeft",
                          "ArrowDown",
                          "ArrowUp",
                        ].includes(event.key)
                      ) {
                        event.preventDefault();
                        const paths = [
                          ...(event.currentTarget.ownerSVGElement?.querySelectorAll<SVGPathElement>(
                            "path[data-country]",
                          ) || []),
                        ];
                        const current = paths.indexOf(event.currentTarget);
                        paths[
                          (current +
                            (["ArrowRight", "ArrowDown"].includes(event.key)
                              ? 1
                              : paths.length - 1)) %
                            paths.length
                        ]?.focus();
                      }
                    }}
                  >
                    <title>
                      {shape.code ? countryName(shape.code, en) : shape.name} ·{" "}
                      {count}
                    </title>
                  </path>
                );
              })}
            </svg>
            <div className="world-map-bottom">
              <div
                className="world-legend"
                aria-label={
                  en
                    ? "Title counts by color"
                    : "Количество материалов по цветам"
                }
              >
                {LEGEND.map((text, i) => (
                  <span key={text}>
                    <i className={`density-${i}`} />
                    {text}
                  </span>
                ))}
              </div>
              <div className="world-map-buttons">
                <button
                  type="button"
                  className="outline-btn small"
                  disabled={!picked}
                  aria-pressed={zoom}
                  onClick={() => setZoom(!zoom)}
                >
                  <ZoomIn size={14} />
                  {zoom
                    ? en
                      ? "World view"
                      : "Весь мир"
                    : en
                      ? "Zoom country"
                      : "Приблизить страну"}
                </button>
                <button
                  type="button"
                  className="outline-btn small"
                  onClick={() => {
                    select("");
                    setCountryQuery("");
                  }}
                >
                  <RotateCcw size={14} />
                  {en ? "Reset country" : "Сбросить страну"}
                </button>
              </div>
            </div>
          </section>
        </div>
        <aside className="atlas-route-panel">
          <span className="eyebrow">
            {en ? "YOUR DESTINATION" : "ТВОЙ МАРШРУТ"}
          </span>
          <h2>
            {selected === "unknown"
              ? en
                ? "Beyond the map"
                : "За пределами карты"
              : selected
                ? countryName(selected, en)
                : en
                  ? "Where shall we go?"
                  : "Куда отправимся?"}
          </h2>
          <p className="atlas-route-summary">
            {selected
              ? en
                ? `${results.length} titles match your selection.`
                : `В текущей выборке: ${results.length} материалов.`
              : en
                ? "Choose a country on the map or use the list. Small territories are here too."
                : "Нажми на карту или выбери страну из списка. Малые территории тоже здесь."}
          </p>
          <div className="world-country-picker">
            <label>
              {en ? "Find a country" : "Найти страну"}
              <input
                type="search"
                value={countryQuery}
                onChange={(e) => setCountryQuery(e.target.value)}
                placeholder={
                  en
                    ? "Country name or ISO code"
                    : "Название страны или ISO-код"
                }
              />
            </label>
            <label>
              {en ? "Selected country" : "Выбранная страна"}
              <select
                aria-label={en ? "Selected country" : "Выбранная страна"}
                value={selected}
                onChange={(e) => select(e.target.value)}
              >
                <option value="">{en ? "All countries" : "Все страны"}</option>
                {selected &&
                  selected !== "unknown" &&
                  !countryList.includes(selected) && (
                    <option value={selected}>
                      {countryName(selected, en)}
                    </option>
                  )}
                {countryList.map((code) => (
                  <option key={code} value={code}>
                    {countryName(code, en)} ·{" "}
                    {index.byCountry.get(code)?.length || 0}
                  </option>
                ))}
                <option value="unknown">
                  {en ? "Unmapped country" : "Без определённой страны"} ·{" "}
                  {index.unmapped.length}
                </option>
              </select>
            </label>
          </div>
          <span className="atlas-search-count" role="status">
            {en ? "Countries found" : "Стран найдено"}: {countryList.length}
          </span>
          {destinations.length > 0 && (
            <div className="atlas-destinations">
              <h3>
                <Compass size={16} />
                {en ? "More titles here" : "Здесь больше историй"}
              </h3>
              <p>
                {en
                  ? "Top countries in the current selection, not recommendations or world coverage."
                  : "Страны с наибольшим числом материалов в текущей выборке."}
              </p>
              {destinations.map((item) => (
                <button
                  type="button"
                  key={item.code}
                  aria-pressed={selected === item.code}
                  onClick={() => select(item.code)}
                >
                  <span>{countryName(item.code, en)}</span>
                  <b>{item.count}</b>
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
          )}
          <a className="outline-btn atlas-to-results" href="#atlas-results">
            {en ? "See titles" : "К историям"} <ArrowDown size={16} />
          </a>
        </aside>
      </section>
      <details className="atlas-reading">
        <summary>
          {en ? "How to read this map" : "Как читать эту карту"}
        </summary>
        <p className="world-map-note">
          {en
            ? "Production countries come from catalog metadata, never inferred from genre or language. Co-productions count once in each listed country. Historical and unknown names are not silently assigned to modern countries."
            : "Страны берём из карточек, а не угадываем по жанру или языку. Совместное производство учитывается по одному разу в каждой указанной стране. Исторические и неизвестные названия не приписываем современным странам."}
        </p>
      </details>
      {selected && selected !== "unknown" && !picked && (
        <p className="world-map-note">
          {en
            ? "This location is available in the catalog but is too small or absent in this map scale."
            : "Локация доступна в каталоге, но слишком мала или отсутствует на карте этого масштаба."}
        </p>
      )}
      {!!index.unmapped.length && (
        <button
          type="button"
          className="world-unmapped"
          aria-pressed={selected === "unknown"}
          onClick={() => select("unknown")}
        >
          {en
            ? `${index.unmapped.length} titles have no recognized production country`
            : `У ${index.unmapped.length} материалов не определена страна производства`}{" "}
          →
        </button>
      )}
      <section
        className="world-results"
        id="atlas-results"
        tabIndex={-1}
        aria-label={
          en ? "Titles from this region" : "Материалы выбранного региона"
        }
      >
        <div className="world-results-heading">
          <h2>
            {selected === "unknown"
              ? en
                ? "Without mapped country"
                : "Без определённой страны"
              : selected
                ? countryName(selected, en)
                : en
                  ? "The whole world of cinema"
                  : "Весь мир кино"}{" "}
            <small>· {results.length}</small>
          </h2>
          <select
            aria-label={
              en ? "Sort regional titles" : "Сортировка материалов региона"
            }
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="rating">{en ? "By rating" : "По рейтингу"}</option>
            <option value="year">
              {en ? "Newest releases" : "Сначала новые"}
            </option>
            <option value="views">{en ? "By views" : "По просмотрам"}</option>
          </select>
        </div>
        {results.length ? (
          <>
            <div className="world-film-grid">
              {results.slice(0, limit).map((film) => (
                <a
                  key={film.id}
                  className={`world-film tone-${materialTone(film)}`}
                  href={`/movie/${film.id}`}
                  onClick={(event) => {
                    if (
                      event.button ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return;
                    event.preventDefault();
                    go(`/movie/${film.id}`);
                  }}
                >
                  <MaterialCover film={film} className="world-film-poster">
                    {watchedIds.has(film.id) && (
                      <b>{en ? "Watched" : "Просмотрено"}</b>
                    )}
                  </MaterialCover>
                  <h3>{film.title}</h3>
                  <p>
                    {film.year} · {film.category}
                  </p>
                  <small>
                    {parseFilmCountries(film.country)
                      .codes.map((code) => countryName(code, en))
                      .join(" · ") ||
                      film.country ||
                      (en ? "Country missing" : "Страна не указана")}
                  </small>
                </a>
              ))}
            </div>
            {limit < results.length && (
              <button
                type="button"
                className="outline-btn"
                onClick={() => setLimit((n) => n + 12)}
              >
                {en ? "Show more" : "Показать ещё"}
              </button>
            )}
          </>
        ) : (
          <div className="empty-state">
            <Globe2 size={34} />
            <h3>
              {en ? "A new destination awaits" : "Это направление ещё впереди"}
            </h3>
            <p>
              {en
                ? "No titles match these filters. Change country, category or map mode."
                : "По этим фильтрам материалов пока нет. Выбери другую страну, категорию или режим карты."}
            </p>
            <button
              type="button"
              className="outline-btn"
              onClick={() => {
                select("");
                setCategory("Все");
                setUnseenOnly(false);
                setMode("catalog");
              }}
            >
              {en ? "Explore the catalog map" : "Открыть карту всего каталога"}
            </button>
          </div>
        )}
      </section>
      <footer className="world-attribution">
        {geography.source}.{" "}
        {en
          ? "Simplified geographic reference, not a statement about political boundaries. Small territories are accessible through the list. Antarctica is omitted."
          : "Упрощённая географическая справка, не утверждение о политических границах. Малые территории доступны через список. Антарктида не показана."}
      </footer>
    </div>
  );
}
