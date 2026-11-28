import test from "node:test";
import assert from "node:assert/strict";
import {
  atlasDestinations,
  groupCinemaShowings,
} from "../src/lib/cinema-journeys";
import { buildCountryIndex } from "../src/lib/cinema-countries";
import type { CinemaShowing } from "../src/lib/showtimes";
const show = (
  id: number,
  movieId = 1,
  cinema = "Космос",
  address = "Мира, 1",
  hour = "12",
): CinemaShowing => ({
  id,
  movieId,
  movie: movieId === 1 ? "История" : "История другая",
  cinema,
  address,
  startsAt: `2026-11-22T${hour}:00:00Z`,
  price: "от 350 ₽",
  format: "2D",
  url: "https://kudago.com/ekb/movie/1/",
});
test("Showings are grouped by source movie ID and cinema/address pair", () => {
  const data = [
    show(1),
    show(2, 1, "Космос", "Мира, 1", "14"),
    show(3, 1, "Космос", "Ленина, 2"),
    show(4, 2),
  ];
  const groups = groupCinemaShowings(data);
  assert.equal(groups.length, 2);
  assert.equal(groups[0][1].venues.size, 2);
  assert.equal([...groups[0][1].venues.values()][0].shows.length, 2);
  assert.equal(groups[1][0], 2);
  const sameTitle = groupCinemaShowings([
    show(1),
    { ...show(2, 2), movie: "История" },
  ]);
  assert.equal(sameTitle.length, 2);
});
test("Cinema and normalized title searches are combined without mutating provider records", () => {
  const data = [show(1), show(2, 1, "Салют"), show(3, 2)];
  const before = JSON.stringify(data);
  assert.equal(
    groupCinemaShowings(data, "  ИСТОРИЯ  ", "Салют")[0][1].venues.size,
    1,
  );
  assert.equal(groupCinemaShowings(data, "САЛЮТ").length, 1);
  assert.equal(groupCinemaShowings(data, "неизвестное").length, 0);
  assert.equal(groupCinemaShowings(data, "", "Несуществующий").length, 0);
  assert.deepEqual(groupCinemaShowings([]), []);
  assert.equal(JSON.stringify(data), before);
});
test("Shows sort by timestamp with a stable ID tie-break without altering the source", () => {
  const data = [show(3, 1, "Космос", "Мира, 1", "16"), show(2), show(1)];
  const groups = groupCinemaShowings(data);
  assert.deepEqual(
    [...groups[0][1].venues.values()][0].shows.map((s) => s.id),
    [1, 2, 3],
  );
  assert.deepEqual(
    data.map((s) => s.id),
    [3, 2, 1],
  );
});
test("Venue names containing separators cannot collide with addresses", () => {
  const groups = groupCinemaShowings([
    show(1, 1, "А|Б", "В"),
    show(2, 1, "А", "Б|В"),
  ]);
  assert.equal(groups[0][1].venues.size, 2);
});
test("Atlas destination counts reflect the selection and co-productions, not inferred coverage", () => {
  const index = buildCountryIndex([
    { id: 1, country: "США, Япония" },
    { id: 2, country: "Япония" },
    { id: 2, country: "Япония" },
    { id: 3, country: "СССР" },
    { id: 4, country: null },
    { id: 5, country: "Франция" },
  ]);
  assert.deepEqual(atlasDestinations(index), [
    { code: "JP", count: 2 },
    { code: "FR", count: 1 },
    { code: "US", count: 1 },
  ]);
  assert.deepEqual(atlasDestinations(index, 1), [{ code: "JP", count: 2 }]);
  assert.deepEqual(atlasDestinations(index, 0), []);
  assert.deepEqual(atlasDestinations(buildCountryIndex([])), []);
  assert.equal(index.unmapped.length, 2);
});
