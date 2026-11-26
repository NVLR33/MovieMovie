import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_ROULETTE_FILTERS as defaults,
  pickRoulette,
  roulettePool,
  rouletteStrip,
  ROULETTE_WINNER_INDEX,
} from '../src/lib/roulette';
const film = (
  id: number,
  category = 'Фильм',
  duration = 100,
  genre = 'Драма',
  rating = 8,
  ratingCount = 2,
) => ({ id, category, duration, genre, rating, ratingCount });
const films = [
  film(1),
  film(2, 'Сериал', 45),
  film(3, 'Мультфильм', 80),
  film(4, 'Фильм', 180),
  film(5, 'Фильм', 0),
  film(6, 'Аниме-фильм', 90),
  film(7, 'Аниме-сериал', 23),
];
const watched = new Set([1, 3]),
  saved = new Set([2, 4]);
test('roulette modes use actual current catalog, watched markers and bookmarks, not ratings or fabricated candidates', () => {
  assert.deepEqual(
    roulettePool(films, 'surprise', defaults, watched, saved, false),
    films,
  );
  assert.deepEqual(
    roulettePool(films, 'unwatched', defaults, watched, saved, true).map(
      (f) => f.id,
    ),
    [2, 4, 5, 6, 7],
  );
  assert.deepEqual(
    roulettePool(films, 'watchlist', defaults, watched, saved, true).map(
      (f) => f.id,
    ),
    [2, 4],
  );
  for (const mode of ['unwatched', 'watchlist'] as const)
    assert.deepEqual(
      roulettePool(films, mode, defaults, watched, saved, false),
      [],
    );
  assert.deepEqual(
    roulettePool(films, 'watchlist', defaults, watched, new Set([999]), true),
    [],
  );
});
test('one evening only includes feature formats with a known positive runtime within the selected limit', () => {
  assert.deepEqual(
    roulettePool(films, 'evening', defaults, watched, saved, false).map(
      (f) => f.id,
    ),
    [1, 3, 6],
  );
  assert.deepEqual(
    roulettePool(
      films,
      'evening',
      { ...defaults, maxMinutes: 90 },
      watched,
      saved,
      false,
    ).map((f) => f.id),
    [3, 6],
  );
  assert(
    roulettePool(
      films,
      'evening',
      { ...defaults, maxMinutes: 180 },
      watched,
      saved,
      false,
    ).some((f) => f.id === 4),
  );
  assert.deepEqual(
    roulettePool(
      [film(9, 'Фильм', NaN), film(10, 'Фильм', -1)],
      'evening',
      defaults,
      watched,
      saved,
      true,
    ),
    [],
  );
});
test('all filters intersect, exact genre tokens are used and unrated titles do not pass rating constraints', () => {
  const items = [
    film(1, 'Фильм', 110, 'Научная фантастика'),
    film(2, 'Фильм', 90, 'Фантастика, Драма'),
    film(3, 'Сериал', 40, 'Драма'),
    film(4, 'Фильм', 100, 'Драма', 9, 0),
  ];
  assert.deepEqual(
    roulettePool(
      items,
      'surprise',
      { ...defaults, genre: 'фантастика' },
      watched,
      saved,
      true,
    ).map((f) => f.id),
    [2],
  );
  assert.deepEqual(
    roulettePool(
      items,
      'surprise',
      { ...defaults, genre: 'Драма', category: 'Фильм', minRating: 8 },
      watched,
      saved,
      true,
    ).map((f) => f.id),
    [2],
  );
  assert.deepEqual(
    roulettePool(
      items,
      'watchlist',
      { ...defaults, genre: 'Нет такого' },
      watched,
      saved,
      true,
    ),
    [],
  );
  assert.equal(
    roulettePool(
      [items[0], items[0]],
      'surprise',
      defaults,
      watched,
      saved,
      true,
    ).length,
    1,
  );
});
test('selection is uniform across remaining candidates, excludes prior draws until exhaustion, avoids immediate repeats after exhaustion', () => {
  const pool = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.equal(pickRoulette(pool, [], () => 0)?.id, 1);
  assert.equal(pickRoulette(pool, [], () => 0.5)?.id, 2);
  assert.equal(pickRoulette(pool, [], () => 0.999)?.id, 3);
  assert.equal(pickRoulette(pool, [1, 2], () => 0)?.id, 3);
  for (const value of [0, 0.5, 0.99])
    assert.notEqual(pickRoulette(pool, [1, 2, 3], () => value)?.id, 3);
  assert.equal(pickRoulette([], []), null);
  assert.equal(pickRoulette([{ id: 1 }], [1])?.id, 1);
  assert.equal(pickRoulette(pool, [999], () => 0)?.id, 1);
});
test('reel center and reported winner are identical, and reel never injects a title outside the eligible pool', () => {
  const pool = [{ id: 1 }, { id: 2 }],
    winner = pool[1],
    strip = rouletteStrip(pool, winner, () => 0);
  assert.equal(strip[ROULETTE_WINNER_INDEX], winner);
  assert.equal(strip.length, 34);
  assert(strip.every((f) => pool.includes(f)));
  assert.deepEqual(rouletteStrip([], winner), []);
});
