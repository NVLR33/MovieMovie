import test from "node:test";
import assert from "node:assert/strict";
import { cinemaSpace, previewMovieId } from "../src/lib/cinema-spaces";
test("spaces keep all existing destinations grouped without inventing routes", () => {
  for (const page of [
    "home",
    "catalog",
    "top",
    "world",
    "showtimes",
    "movie",
    "admin",
    "unknown",
  ])
    assert.equal(cinemaSpace(page), "discover");
  for (const page of ["watchlist", "favorites", "profile", "wrapped"])
    assert.equal(cinemaSpace(page), "library");
  for (const page of [
    "collab",
    "friends",
    "chat",
    "games",
    "achievements",
    "challenges",
    "leaderboard",
    "watchroom",
    "room",
    "compare",
    "viewuser",
  ])
    assert.equal(cinemaSpace(page), "together");
});
test("only plain valid movie browsing links become a quick look", () => {
  assert.equal(previewMovieId("/movie/1"), 1);
  assert.equal(previewMovieId("/movie/2147483647"), 2147483647);
  for (const href of [
    "/movie/0",
    "/movie/-1",
    "/movie/01",
    "/movie/2147483648",
    "/movie/1/reviews",
    "/movie/1#comments",
    "/movie/1?season=2",
    "https://example.test/movie/1",
    "//example.test/movie/1",
    "/catalog",
    "/user/1",
  ])
    assert.equal(previewMovieId(href), null, href);
});
