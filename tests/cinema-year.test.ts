import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CINEMA_YEAR_CHAPTERS,
  cinemaYearCard,
  cinemaYearStep,
  cinemaYears,
} from "../src/lib/cinema-year";
test("yearbook exposes exactly the nine existing story chapters in slide order", () => {
  assert.equal(CINEMA_YEAR_CHAPTERS.length, 9);
  assert.equal(new Set(CINEMA_YEAR_CHAPTERS.map((c) => c.icon)).size, 9);
  assert.equal(CINEMA_YEAR_CHAPTERS[0].title, "Пролог");
  assert.equal(CINEMA_YEAR_CHAPTERS[8].title, "Титры");
});
test("year selector follows the existing API range from the current UTC year through 2000", () => {
  const years = cinemaYears(2026);
  assert.equal(years[0], 2026);
  assert.equal(years.at(-1), 2000);
  assert.equal(years.length, 27);
  assert.deepEqual(cinemaYears(2000), [2000]);
  assert.deepEqual(cinemaYears(1999), []);
  assert(!years.includes(2027));
});
test("chapter entry is bounded and finite without inventing extra slides", () => {
  assert.equal(cinemaYearStep(-10), 0);
  assert.equal(cinemaYearStep(99), 8);
  assert.equal(cinemaYearStep(NaN), 0);
  assert.equal(cinemaYearStep(Infinity), 0);
  assert.equal(cinemaYearStep(3.9), 3);
});
test("share shortcut selects the matching existing card with a summary fallback", () => {
  assert.deepEqual(
    Array.from({ length: 9 }, (_, index) => cinemaYearCard(index)),
    [
      "summary",
      "time",
      "summary",
      "genre",
      "summary",
      "movie",
      "summary",
      "achievements",
      "summary",
    ],
  );
});
