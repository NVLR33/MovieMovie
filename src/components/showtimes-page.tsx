"use client";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ExternalLink,
  Film,
  MapPin,
  RefreshCw,
  Search,
  Ticket,
} from "lucide-react";
import { CityChooser, useCity } from "./city-cinema";
import { cinemaSearchUrl } from "@/lib/city-location";
import type { ShowtimesSnapshot, CinemaShowing } from "@/lib/showtimes";

export default function ShowtimesPage({ en = false }: { en?: boolean }) {
  const city = useCity();
  const [selection, setSelection] = useState({ city: "", date: "" });
  const date = selection.city === city ? selection.date : "";
  const [revision, setRevision] = useState(0);
  const key = city + "|" + date + "|" + revision;
  const [result, setResult] = useState<{
    key: string;
    data?: ShowtimesSnapshot;
    error?: string;
  }>({ key: "" });
  const [filter, setFilter] = useState({ city: "", search: "", cinema: "" });
  const search = filter.city === city ? filter.search : "",
    cinema = filter.city === city ? filter.cinema : "";
  const data = result.key === key ? result.data : undefined,
    error = result.key === key ? result.error : "";
  const loading = !!city && !data && !error;
  useEffect(() => {
    if (!city) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ city, ...(date ? { date } : {}) });
    void fetch("/api/showtimes?" + params, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || "Не удалось загрузить афишу.");
        if (
          !Array.isArray(body.showings) ||
          !["ready", "unsupported"].includes(body.status) ||
          typeof body.timezone !== "string"
        )
          throw new Error("Некорректный ответ источника.");
        if (!controller.signal.aborted) setResult({ key, data: body });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            error:
              error instanceof Error
                ? error.message
                : "Не удалось загрузить афишу.",
          });
      });
    return () => controller.abort();
  }, [city, date, key]);
  const cinemas = useMemo(
    () =>
      [...new Set(data?.showings.map((show) => show.cinema) || [])].sort(
        (a, b) => a.localeCompare(b, "ru"),
      ),
    [data],
  );
  const groups = useMemo(() => {
    const groups = new Map<
      number,
      {
        title: string;
        venues: Map<
          string,
          { name: string; address: string; shows: CinemaShowing[] }
        >;
      }
    >();
    for (const show of data?.showings || []) {
      if (cinema && show.cinema !== cinema) continue;
      if (
        search &&
        !`${show.movie} ${show.cinema}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase())
      )
        continue;
      let group = groups.get(show.movieId);
      if (!group) {
        group = { title: show.movie, venues: new Map() };
        groups.set(show.movieId, group);
      }
      const venueKey = show.cinema + "|" + show.address;
      let venue = group.venues.get(venueKey);
      if (!venue) {
        venue = { name: show.cinema, address: show.address, shows: [] };
        group.venues.set(venueKey, venue);
      }
      venue.shows.push(show);
    }
    return [...groups.entries()];
  }, [data, search, cinema]);
  const external = cinemaSearchUrl(city);
  const time = (value: string) =>
    new Date(value).toLocaleTimeString(en ? "en-GB" : "ru-RU", {
      timeZone: data?.timezone || "Europe/Moscow",
      hour: "2-digit",
      minute: "2-digit",
    });
  const updateFilter = (patch: Partial<{ search: string; cinema: string }>) =>
    setFilter({ city, search, cinema, ...patch });
  return (
    <div className="showtimes-page">
      <header className="showtimes-heading">
        <div>
          <span className="eyebrow">
            {en ? "A NIGHT AT THE CINEMA" : "КИНО НА БОЛЬШОМ ЭКРАНЕ"}
          </span>
          <h1>{en ? "Cinema showtimes" : "Афиша и сеансы"}</h1>
          <p>
            <MapPin size={15} />
            {city ||
              (en
                ? "Choose your city to get started"
                : "Начни с выбора города")}
          </p>
        </div>
        <span className="showtimes-heading-icon" aria-hidden="true">
          <Ticket size={32} />
        </span>
      </header>
      <section
        className="showtimes-city-panel"
        aria-label={en ? "Showtimes city" : "Город афиши"}
      >
        <details open={!city || undefined}>
          <summary>
            <MapPin size={16} />
            {city || (en ? "Choose a city" : "Выбрать город")}
            <span>{city ? (en ? "Change city" : "Изменить город") : ""}</span>
          </summary>
          <CityChooser en={en} />
        </details>
      </section>
      {city && (
        <>
          <div className="showtimes-source-note">
            <Ticket size={17} />
            <p>
              {en
                ? "Real showings from KudaGo, with limited city and cinema coverage. This is not a complete list or a ticket availability guarantee."
                : "Полученные сеансы KudaGo. Покрытие городов и кинотеатров ограничено — это не полная афиша и не гарантия наличия билетов."}
            </p>
          </div>
          {loading && (
            <div className="showtimes-loading" role="status">
              <RefreshCw size={20} />
              {en ? "Loading showtimes…" : "Загружаем сеансы…"}
            </div>
          )}
          {error && (
            <div className="showtimes-empty" role="alert">
              <h2>
                {en
                  ? "Could not load showtimes"
                  : "Не удалось загрузить сеансы"}
              </h2>
              <p>{error}</p>
              <button
                type="button"
                className="outline-btn"
                onClick={() => setRevision((value) => value + 1)}
              >
                <RefreshCw size={16} />
                {en ? "Retry" : "Повторить"}
              </button>
            </div>
          )}
          {data?.status === "unsupported" && (
            <div className="showtimes-empty">
              <MapPin size={28} />
              <h2>
                {en
                  ? "This city is not covered yet"
                  : "Для этого города у источника пока нет афиши"}
              </h2>
              <p>
                {en
                  ? "We will not substitute a nearby city or invent showtimes. Choose another city or use the external search below."
                  : "Не подменяем город соседним и не придумываем сеансы. Можно выбрать другой город или воспользоваться внешним поиском ниже."}
              </p>
            </div>
          )}
          {data?.status === "ready" && (
            <>
              <div className="showtimes-filters">
                <label>
                  <span>
                    <CalendarDays size={14} />
                    {en ? "Date" : "Дата"}
                  </span>
                  <select
                    aria-label={en ? "Showtime date" : "Дата сеансов"}
                    value={data.date}
                    onChange={(event) =>
                      setSelection({ city, date: event.target.value })
                    }
                  >
                    {Array.from({ length: 7 }, (_, n) => {
                      const day = new Date(
                        Date.parse(data.today + "T12:00:00Z") + n * 86400000,
                      )
                        .toISOString()
                        .slice(0, 10);
                      return (
                        <option key={day} value={day}>
                          {n === 0
                            ? en
                              ? "Today"
                              : "Сегодня"
                            : new Date(day + "T12:00:00Z").toLocaleDateString(
                                en ? "en-GB" : "ru-RU",
                                {
                                  day: "numeric",
                                  month: "long",
                                  timeZone: "UTC",
                                },
                              )}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label>
                  <span>{en ? "Cinema" : "Кинотеатр"}</span>
                  <select
                    aria-label={en ? "Cinema" : "Кинотеатр"}
                    value={cinema}
                    onChange={(event) =>
                      updateFilter({ cinema: event.target.value })
                    }
                  >
                    <option value="">
                      {en ? "All cinemas" : "Все кинотеатры"}
                    </option>
                    {cinemas.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                </label>
                <label className="showtimes-search">
                  <span>
                    <Search size={14} />
                    {en ? "Find a movie" : "Найти фильм"}
                  </span>
                  <input
                    type="search"
                    maxLength={160}
                    aria-label={en ? "Search showtimes" : "Поиск по афише"}
                    value={search}
                    onChange={(event) =>
                      updateFilter({ search: event.target.value })
                    }
                    placeholder={
                      en ? "Movie or cinema" : "Название фильма или кинотеатра"
                    }
                  />
                </label>
              </div>
              <div className="showtimes-result-meta" role="status">
                <span>
                  {en ? "Movies" : "Фильмов"}: <b>{groups.length}</b> ·{" "}
                  {en
                    ? "Times are local to the selected city"
                    : "Время — в часовом поясе выбранного города"}{" "}
                  ({data.timezone})
                </span>
                <small>
                  {en ? "Updated" : "Обновлено"}: {time(data.updatedAt)}
                </small>
              </div>
              {data.truncated && (
                <p className="showtimes-partial">
                  {en
                    ? "Only part of the source schedule is shown. Check the source for more."
                    : "Показана только часть расписания источника. Остальные сеансы проверяй на его сайте."}
                </p>
              )}
              {!groups.length && (
                <div className="showtimes-empty">
                  <Film size={28} />
                  <h2>
                    {search || cinema
                      ? en
                        ? "No matches"
                        : "По этим фильтрам ничего нет"
                      : en
                        ? "No showtimes received"
                        : "Сеансы на эту дату не получены"}
                  </h2>
                  <p>
                    {en
                      ? "This does not mean cinemas are closed. Try another date or verify at the source."
                      : "Это не означает, что кинотеатры не работают. Выбери другую дату или проверь афишу у источника."}
                  </p>
                  {(search || cinema) && (
                    <button
                      type="button"
                      className="outline-btn"
                      onClick={() =>
                        setFilter({ city, search: "", cinema: "" })
                      }
                    >
                      {en ? "Clear filters" : "Сбросить фильтры"}
                    </button>
                  )}
                </div>
              )}
              <div className="showtimes-movies">
                {groups.map(([id, movie]) => (
                  <article key={id} className="showtime-movie">
                    <header>
                      <span aria-hidden="true">
                        <Film size={20} />
                      </span>
                      <div>
                        <small>{en ? "IN CINEMAS" : "В КИНОТЕАТРАХ"}</small>
                        <h2>{movie.title}</h2>
                      </div>
                    </header>
                    {[...movie.venues.entries()].map(([key, venue]) => (
                      <section className="showtime-venue" key={key}>
                        <div>
                          <h3>{venue.name}</h3>
                          {venue.address && (
                            <p>
                              <MapPin size={12} />
                              {venue.address}
                            </p>
                          )}
                        </div>
                        <div className="showtime-slots">
                          {venue.shows.map((show) => (
                            <a
                              key={show.id}
                              href={show.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              referrerPolicy="no-referrer"
                              title={`${show.movie} · ${venue.name} · ${show.format || ""} · ${show.price || (en ? "Price at source" : "Цена у источника")}`}
                            >
                              <b>{time(show.startsAt)}</b>
                              {show.price && <small>{show.price}</small>}
                              {show.format && <small>{show.format}</small>}
                              <span>
                                KudaGo <ExternalLink size={10} />
                              </span>
                            </a>
                          ))}
                        </div>
                      </section>
                    ))}
                  </article>
                ))}
              </div>
            </>
          )}
          {external && (
            <aside className="showtimes-external">
              <div>
                <h3>
                  {en ? "Need more options?" : "Нужны другие кинотеатры?"}
                </h3>
                <p>
                  {en
                    ? "An external search, not showtimes verified by moviemovie. Check dates, prices and ticket availability at the destination."
                    : "Внешний поиск — не подтверждённые moviemovie сеансы. Даты, цены и наличие билетов проверяй на сайте назначения."}
                </p>
              </div>
              <a
                className="outline-btn"
                href={external}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
              >
                {en ? "Search outside moviemovie" : "Искать во внешнем сервисе"}
                <ExternalLink size={15} />
              </a>
            </aside>
          )}
        </>
      )}
    </div>
  );
}
