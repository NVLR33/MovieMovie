import test from "node:test";
import assert from "node:assert/strict";
import { buildPracticeRound, gameModes } from "../src/lib/cinema-practice";
import {
  challengeCatalogPath,
  achievementState,
  selectAchievements,
  nearestAchievement,
} from "../src/lib/cinema-progression";
import { achievementDefs } from "../src/lib/achievements";
import type { Film } from "../src/lib/data";
const names = [
  "Альфа",
  "Бета",
  "Гамма",
  "Дельта",
  "Эпсилон",
  "Зета",
  "Эта",
  "Тета",
  "Йота",
  "Каппа",
];
const films: Film[] = names.map((title, i) => ({
  id: i + 1,
  title,
  originalTitle: "Original " + i,
  description: "История " + i,
  category: [
    "Фильм",
    "Сериал",
    "Аниме-сериал",
    "Мультфильм",
    "Мультсериал",
    "Аниме-фильм",
  ][i % 6],
  genre:
    i < 3
      ? "Драма"
      : i === 3
        ? "Мелодрама"
        : ["Триллер", "Фантастика", "Комедия", "Боевик", "Ужасы", "Детектив"][
            i - 4
          ],
  studio: null,
  mood: null,
  year: 1980 + i,
  duration: 80 + i * 5,
  episodes: null,
  poster: "/brand/moviemovie-logo.png",
  backdrop: null,
  watchUrl: null,
  director: "Director " + i,
  country: "Country " + i,
  featured: false,
  views: 0,
  createdAt: new Date(0),
  rating: 60 + i,
  ratingCount: 1,
  ratingDist: {},
}));
const rng = (seed: number) => () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
for (const mode of gameModes)
  test(`${mode.id}: five grounded questions with four distinct options`, () => {
    for (let seed = 0; seed < 20; seed++) {
      const questions = buildPracticeRound(films, mode.id, rng(seed));
      assert.equal(questions.length, 5);
      for (const q of questions) {
        assert.equal(q.options.length, 4);
        assert.equal(new Set(q.options).size, 4);
        assert.equal(q.options.filter((o) => o === q.correct).length, 1);
        assert(films.some((f) => f.id === q.movieId));
        assert(q.question);
        if (mode.id === "chrono") {
          const year = films.find((f) => f.title === q.correct)!.year;
          assert(
            q.options
              .filter((v) => v !== q.correct)
              .every((v) => films.find((f) => f.title === v)!.year > year),
          );
        }
        if (mode.id === "higher") {
          const rating = films.find((f) => f.title === q.correct)!.rating;
          assert(
            q.options
              .filter((v) => v !== q.correct)
              .every((v) => films.find((f) => f.title === v)!.rating < rating),
          );
        }
        if (mode.id === "connections") {
          assert(
            !films
              .find((f) => f.title === q.correct)!
              .genre.split(",")
              .includes("Драма"),
          );
          assert.equal(
            q.options.filter(
              (v) => films.find((f) => f.title === v)!.genre === "Драма",
            ).length,
            3,
          );
        }
      }
    }
  });
test("Short catalogs, unknown modes and missing metadata do not invent answers", () => {
  for (const mode of gameModes) {
    assert.deepEqual(buildPracticeRound([], mode.id), []);
    assert.deepEqual(buildPracticeRound(films.slice(0, 3), mode.id), []);
  }
  assert.deepEqual(buildPracticeRound(films, "injected-mode"), []);
  for (const mode of [
    "director",
    "original",
    "poster",
    "country",
    "genre",
    "story",
  ])
    assert.deepEqual(
      buildPracticeRound(
        films.map((f) => ({
          ...f,
          director: null,
          originalTitle: null,
          poster: "",
          country: null,
          genre: "",
          description: "",
        })),
        mode,
      ),
      [],
    );
  assert.deepEqual(
    buildPracticeRound([...films.slice(0, 3), films[0]], "story"),
    [],
  );
});
test("A four-film chronological question always contains the correct earliest film", () => {
  const round = buildPracticeRound(films.slice(0, 4), "chrono", rng(3));
  assert.equal(round.length, 5);
  assert(
    round.every((q) => q.correct === "Альфа" && q.options.includes("Альфа")),
  );
});
test("Tied ratings and release dates cannot produce ambiguous answers", () => {
  assert.deepEqual(
    buildPracticeRound(
      films.map((f) => ({ ...f, year: 2000 })),
      "chrono",
    ),
    [],
  );
  assert.deepEqual(
    buildPracticeRound(
      films.map((f) => ({ ...f, rating: 80 })),
      "higher",
    ),
    [],
  );
  assert.deepEqual(
    buildPracticeRound(
      films.map((f) => ({ ...f, ratingCount: 0 })),
      "higher",
    ),
    [],
  );
});
test("Genre matching is token based, not a substring of melodrama", () => {
  const questions = buildPracticeRound(
    films.slice(0, 4),
    "connections",
    rng(7),
  );
  assert(questions.some((q) => q.correct === "Дельта"));
  assert(
    questions.every(
      (q) =>
        q.correct === "Дельта" ||
        films.find((f) => f.title === q.correct)!.genre !== "Драма",
    ),
  );
  const withSecondary = films.map((f, i) =>
    i === 0 ? { ...f, genre: "Драма, Триллер" } : f,
  );
  for (const q of buildPracticeRound(withSecondary, "genre", rng(8))) {
    const film = withSecondary.find((f) => f.id === q.movieId)!;
    assert.equal(
      q.options.filter((o) =>
        film.genre
          .split(",")
          .map((v) => v.trim())
          .includes(o),
      ).length,
      1,
    );
  }
});
test("Progression uses the original four thresholds without modifying them", () => {
  const before = JSON.stringify(achievementDefs);
  assert.deepEqual(achievementState([1, 10, 30, 100], 0), {
    value: 0,
    tier: 0,
    next: 1,
    maxed: false,
    percent: 0,
  });
  assert.equal(achievementState([1, 10, 30, 100], 10).tier, 2);
  assert.equal(achievementState([1, 10, 30, 100], 10).next, 30);
  assert.equal(achievementState([1, 10, 30, 100], 100).tier, 4);
  assert.equal(achievementState([1, 10, 30, 100], 1000).percent, 100);
  assert.equal(achievementState([1, 10, 30, 100], NaN).value, 0);
  assert.equal(achievementState([1, 10, 30, 100], -2).value, 0);
  assert.equal(
    selectAchievements({ watch: 1 }, " ПЕРВЫЙ ", "all", "unlocked")[0]?.id,
    "watch",
  );
  assert.equal(
    selectAchievements({ watch: 1 }, "Первый", "all", "locked").length,
    0,
  );
  assert.equal(
    selectAchievements({ watch: 100 }, "", "Просмотры", "maxed")[0]?.id,
    "watch",
  );
  assert.equal(
    selectAchievements({}, "несуществующее", "all", "all").length,
    0,
  );
  assert.equal(nearestAchievement({ watch: 9 })?.definition.id, "watch");
  assert.equal(
    nearestAchievement(
      Object.fromEntries(achievementDefs.map((a) => [a.id, 999999])),
    ),
    null,
  );
  assert.equal(JSON.stringify(achievementDefs), before);
});

test("Challenge catalog route applies both conditions without changing reward rules", () => {
  const url = new URL(
    challengeCatalogPath({ filterGenre: "Драма", filterCategory: "Фильм" }),
    "https://example.test",
  );
  assert.equal(url.searchParams.get("genre"), "Драма");
  assert.equal(url.searchParams.get("category"), "Фильм");
  assert.equal(challengeCatalogPath({}), "/catalog");
});
