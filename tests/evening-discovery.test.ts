import test from "node:test";
import assert from "node:assert/strict";
import {
  EVENING_MOODS,
  eveningCandidates,
  eveningCatalogUrl,
} from "../src/lib/evening-discovery";
import { matchesCatalogMood } from "../src/lib/catalog-moods";
const films = [
  { id: 3, title: "Драма", genre: "Драма", rating: 8, ratingCount: 10 },
  {
    id: 2,
    title: "Приключение",
    genre: "Приключения, Комедия",
    rating: 8,
    ratingCount: 20,
  },
  { id: 1, title: "Триллер", genre: "Триллер", rating: 9, ratingCount: 5 },
  { id: 4, title: "Космос", genre: "Фантастика", rating: 0, ratingCount: 0 },
  {
    id: 5,
    title: "Редакторский тег",
    genre: "Драма",
    mood: "mind",
    rating: 7,
    ratingCount: 3,
  },
];
test("evening candidates reuse catalog mood rules, including editorial overrides", () => {
  for (const mood of EVENING_MOODS) {
    assert.deepEqual(
      new Set(eveningCandidates(films, mood.id).map((f) => f.id)),
      new Set(
        films.filter((f) => matchesCatalogMood(f, mood.id)).map((f) => f.id),
      ),
    );
  }
  assert.deepEqual(
    eveningCandidates(films, "mind").map((f) => f.id),
    [5, 4],
  );
  assert.deepEqual(
    eveningCandidates(films, "tears").map((f) => f.id),
    [3],
  );
});
test("discovery sorts deterministically without mutating the catalog", () => {
  const original = films.slice();
  assert.deepEqual(
    eveningCandidates(films, "all").map((f) => f.id),
    [1, 2, 3, 5, 4],
  );
  assert.deepEqual(films, original);
  const tied = [films[0], { ...films[0], id: 1 }];
  assert.deepEqual(
    eveningCandidates(tied, "all").map((f) => f.id),
    [1, 3],
  );
});
test("empty discovery does not substitute unrelated movies", () => {
  assert.deepEqual(eveningCandidates([], "all"), []);
  assert.deepEqual(eveningCandidates([films[0]], "grip"), []);
});
test("discovery destinations use the existing catalog mood parameter", () => {
  assert.equal(eveningCatalogUrl("all"), "/catalog");
  for (const { id } of EVENING_MOODS) {
    const url = new URL(eveningCatalogUrl(id), "https://example.test");
    assert.equal(url.pathname, "/catalog");
    assert.equal(url.searchParams.get("mood"), id);
  }
});
