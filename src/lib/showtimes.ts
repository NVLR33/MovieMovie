import { normalizeCity } from "./city-location";
import {
  publicProviderJson,
  providerText,
  record,
  type FetchJson,
} from "./public-provider";
export type CinemaShowing = {
  id: number;
  movieId: number;
  movie: string;
  cinema: string;
  address: string;
  startsAt: string;
  price: string;
  format: string;
  url: string;
};
export type ShowtimesSnapshot = {
  city: string;
  date: string;
  today: string;
  timezone: string;
  source: "KudaGo";
  status: "ready" | "unsupported";
  showings: CinemaShowing[];
  updatedAt: string;
  truncated: boolean;
};
type Location = { slug: string; name: string; timezone: string };
const API = "https://kudago.com/public-api/v1.4";
const cityKey = (value: string) =>
  value
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[\s-]+/g, " ");
function timezone(value: unknown): string {
  if (typeof value === "string" && value.length < 80)
    try {
      new Intl.DateTimeFormat("en", { timeZone: value }).format();
      return value;
    } catch {}
  return "";
}
export function localDate(now: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function dateAfter(date: string, days: number): string {
  return new Date(Date.parse(date + "T12:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function validShowDate(date: string, today: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date + "T12:00:00Z")) &&
    new Date(date + "T12:00:00Z").toISOString().startsWith(date) &&
    date >= today &&
    date <= dateAfter(today, 6)
  );
}
function midnight(date: string, zone: string): number {
  const target = Date.parse(date + "T00:00:00Z");
  let guess = target;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let n = 0; n < 3; n++) {
    const parts = formatter.formatToParts(guess),
      get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
    const wall = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );
    guess += target - wall;
  }
  return Math.floor(guess / 1000);
}
function list(value: unknown): { items: unknown[]; more: boolean } {
  const data = record(value);
  if (!Array.isArray(data.results))
    throw new Error("Invalid provider response");
  return { items: data.results, more: !!data.next };
}
async function getLocations(get: FetchJson): Promise<Location[]> {
  const value = await get(
    API + "/locations/?lang=ru&fields=slug,name,timezone",
  );
  const rows = Array.isArray(value) ? value : list(value).items;
  const result = rows
    .slice(0, 250)
    .map(record)
    .filter(
      (row) =>
        typeof row.slug === "string" &&
        /^[a-z0-9-]{1,30}$/.test(row.slug) &&
        normalizeCity(row.name) &&
        timezone(row.timezone),
    )
    .map((row) => ({
      slug: row.slug as string,
      name: normalizeCity(row.name),
      timezone: timezone(row.timezone),
    }));
  if (!result.length) throw new Error("Invalid provider location list");
  return result;
}
let locations: { until: number; promise: Promise<Location[]> } | null = null;
async function locationsCached(get: FetchJson) {
  if (get !== publicProviderJson) return getLocations(get);
  if (!locations || locations.until < Date.now()) {
    const entry = { until: Date.now() + 86400000, promise: getLocations(get) };
    locations = entry;
    entry.promise.catch(() => {
      if (locations === entry) locations = null;
    });
  }
  return locations.promise;
}
export class ShowtimesInputError extends Error {}
export async function loadShowtimes(
  city: string,
  requestedDate = "",
  get: FetchJson = publicProviderJson,
  now = new Date(),
): Promise<ShowtimesSnapshot> {
  const valid = normalizeCity(city);
  if (!valid) throw new ShowtimesInputError("Выбери корректный город.");
  const location = (await locationsCached(get)).find(
    (item) => cityKey(item.name) === cityKey(valid),
  );
  const zone = location?.timezone || "Europe/Moscow",
    today = localDate(now, zone),
    date = requestedDate || today;
  if (!validShowDate(date, today))
    throw new ShowtimesInputError("Выбери дату в ближайшие семь дней.");
  const base: ShowtimesSnapshot = {
    city: valid,
    date,
    today,
    timezone: zone,
    source: "KudaGo",
    status: location ? "ready" : "unsupported",
    showings: [],
    updatedAt: now.toISOString(),
    truncated: false,
  };
  if (!location) return base;
  const since = Math.max(
      midnight(date, zone),
      Math.floor(now.getTime() / 1000),
    ),
    until = midnight(dateAfter(date, 1), zone);
  const rows: unknown[] = [];
  let more = false;
  // Bounded provider pagination. We explicitly label partial results; never follow provider-supplied URLs.
  for (let page = 1; page <= 2; page++) {
    const params = new URLSearchParams({
      location: location.slug,
      actual_since: String(since),
      actual_until: String(until - 1),
      page_size: "100",
      page: String(page),
      order_by: "datetime",
      fields:
        "id,movie,place,datetime,price,three_d,imax,four_dx,original_language",
    });
    const data = list(await get(API + "/movie-showings/?" + params));
    rows.push(...data.items.slice(0, 100));
    more = data.more;
    if (!more) break;
  }
  const shows = rows.map(record),
    id = (value: unknown) => {
      const n = Number(typeof value === "number" ? value : record(value).id);
      return Number.isSafeInteger(n) && n > 0 ? n : 0;
    };
  async function lookup(path: string, values: number[], fields: string) {
    const result = new Map<number, Record<string, unknown>>(),
      ids = [...new Set(values)].filter(Boolean).slice(0, 200);
    for (let offset = 0; offset < ids.length; offset += 100) {
      const params = new URLSearchParams({
        ids: ids.slice(offset, offset + 100).join(","),
        page_size: "100",
        fields,
      });
      const data = list(await get(API + path + "?" + params));
      for (const value of data.items) {
        const row = record(value);
        if (Number.isSafeInteger(row.id)) result.set(row.id as number, row);
      }
    }
    return result;
  }
  const [movies, places] = await Promise.all([
    lookup(
      "/movies/",
      shows.map((row) => id(row.movie)),
      "id,title",
    ),
    lookup(
      "/places/",
      shows.map((row) => id(row.place)),
      "id,title,address",
    ),
  ]);
  const seen = new Set<number>();
  let skipped = 0;
  for (const row of shows) {
    const movieId = id(row.movie),
      movie = movies.get(movieId),
      place = places.get(id(row.place));
    const showingId = Number(row.id),
      starts = Number(row.datetime),
      name = providerText(movie?.title),
      cinema = providerText(place?.title);
    if (
      !Number.isSafeInteger(showingId) ||
      showingId <= 0 ||
      !Number.isFinite(starts) ||
      starts < since ||
      starts >= until ||
      !name ||
      !cinema
    ) {
      skipped++;
      continue;
    }
    if (seen.has(showingId)) continue;
    seen.add(showingId);
    base.showings.push({
      id: showingId,
      movieId,
      movie: name,
      cinema,
      address: providerText(place?.address, 240),
      startsAt: new Date(starts * 1000).toISOString(),
      price: providerText(row.price, 80),
      format: [
        row.imax === true ? "IMAX" : "",
        row.three_d === true ? "3D" : "",
        row.four_dx === true ? "4DX" : "",
        row.original_language === true ? "Оригинальный язык" : "",
      ]
        .filter(Boolean)
        .join(" · "),
      url: `https://kudago.com/${location.slug}/movie/${movieId}/`,
    });
  }
  base.showings.sort(
    (a, b) => a.startsAt.localeCompare(b.startsAt) || a.id - b.id,
  );
  base.truncated = more || skipped > 0;
  return base;
}
const snapshots = new Map<
  string,
  { until: number; promise: Promise<ShowtimesSnapshot> }
>();
export async function cachedShowtimes(city: string, date: string) {
  const key =
    cityKey(city) + ":" + date + ":" + Math.floor(Date.now() / 300000);
  let entry = snapshots.get(key);
  if (!entry || entry.until < Date.now()) {
    for (const [id, value] of snapshots)
      if (value.until < Date.now()) snapshots.delete(id);
    if (snapshots.size >= 96) snapshots.delete(snapshots.keys().next().value!);
    entry = { until: Date.now() + 300000, promise: loadShowtimes(city, date) };
    snapshots.set(key, entry);
    const current = entry;
    entry.promise.catch(() => {
      if (snapshots.get(key) === current) snapshots.delete(key);
    });
  }
  const data = await entry.promise;
  return {
    ...data,
    showings: data.showings.filter(
      (show) => Date.parse(show.startsAt) > Date.now(),
    ),
  };
}
