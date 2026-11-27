import assert from "node:assert/strict";
import { test } from "node:test";
import {
  catalogDayTags,
  dailyCatalogDay,
  cineDayKey,
} from "../src/lib/cine-day";
import { filterCatalog, parseCatalogOptions } from "../src/lib/catalog-filter";
const film = (id: number, genre: string) => ({
  id,
  title: `Title ${id}`,
  description: "",
  category: "Фильм",
  genre,
  year: 2024,
  rating: 8,
  views: 0,
});
test("daily tags come only from current comma-separated genres, deduplicated per title and case-insensitively", () => {
  const tags = catalogDayTags([
    film(1, " Драма, Комедия, драма "),
    film(2, "Драма, Семейный"),
    film(3, ""),
    film(4, "Все жанры"),
  ]);
  assert.deepEqual(
    tags.map((t) => [t.filter, t.count]),
    [
      ["Драма", 2],
      ["Комедия", 1],
      ["Семейный", 1],
    ],
  );
  assert.deepEqual(catalogDayTags([]), []);
  assert.equal(dailyCatalogDay([]), null);
});
test("every generated link opens nonempty exact-genre results, even with URL-special characters and overlapping tag names", () => {
  const films = [
    film(1, "Фантастика, Научная фантастика"),
    film(2, "Научная фантастика"),
    film(3, "Арт & кино + #1?"),
    film(4, "Драма"),
  ];
  for (const tag of catalogDayTags(films)) {
    const url = new URL(tag.href, "https://example.test");
    assert.equal(url.pathname, "/catalog");
    assert.equal(url.searchParams.get("search"), null);
    assert.equal(url.searchParams.get("genre"), tag.filter);
    const matches = filterCatalog(
      films,
      parseCatalogOptions(url.searchParams),
      new Set(),
    );
    assert.equal(matches.length, tag.count);
    assert(matches.length > 0);
  }
});
test("one seeded catalog tag per Moscow day, stable across refreshes and catalog order", () => {
  const tags = catalogDayTags([film(1, "Драма, Комедия, Триллер")]);
  const morning = new Date("2026-11-22T00:00:00Z");
  const evening = new Date("2026-11-22T20:59:59Z");
  assert.deepEqual(
    dailyCatalogDay(tags, morning),
    dailyCatalogDay([...tags].reverse(), evening),
  );
  assert.equal(cineDayKey(new Date("2026-11-22T20:59:59Z")), "2026-11-22");
  assert.equal(cineDayKey(new Date("2026-11-22T21:00:00Z")), "2026-11-23");
  const days = Array.from(
    { length: 30 },
    (_, n) =>
      dailyCatalogDay(tags, new Date(morning.getTime() + n * 86400000))!.filter,
  );
  for (let n = 1; n < days.length; n++) assert.notEqual(days[n], days[n - 1]);
  for (const tag of tags)
    assert.equal(days.filter((day) => day === tag.filter).length, 10);
  assert.equal(dailyCatalogDay(tags.slice(0, 1), morning), tags[0]);
});
test("removed genres cannot remain in a refreshed daily pool", () => {
  const after = catalogDayTags([film(1, "Драма")]);
  assert.equal(dailyCatalogDay(after)?.filter, "Драма");
});
