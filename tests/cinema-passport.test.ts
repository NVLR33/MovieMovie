import test from 'node:test';
import assert from 'node:assert/strict';
import {
  passportStats,
  type PassportFilm,
  type PassportWatch,
} from '../src/lib/cinema-passport';
const now = Date.parse('2026-11-22T12:00:00Z');
const films: PassportFilm[] = [
  {
    id: 1,
    title: 'A',
    genre: 'Драма, Комедия',
    country: 'Россия, США',
    poster: '',
    year: 2020,
  },
  { id: 2, title: 'B', genre: 'Драма', country: 'США', poster: '', year: 2021 },
  { id: 3, title: 'C', genre: '', country: 'СССР', poster: '', year: 1980 },
  {
    id: 4,
    title: 'D',
    genre: 'Аниме',
    country: 'Япония',
    poster: '',
    year: 2022,
  },
];
const w = (movieId: number, day: string): PassportWatch => ({
  movieId,
  watchedAt: day,
});
test('passport is honest for a new account; suggests a real unseen production country', () => {
  const s = passportStats(films, [], now);
  assert.equal(s.streak, 0);
  assert.equal(s.best, 0);
  assert.deepEqual(s.genres, []);
  assert.equal(s.countries.byCountry.size, 0);
  assert.equal(s.newest, null);
  assert.equal(s.discovery?.id, 1);
  assert.equal(s.week.length, 7);
  assert(s.week.every((d) => !d.active));
});
test('consecutive-day streak survives yesterday, ignores duplicate days, and expires after a gap', () => {
  const watches = [
    w(1, '2026-11-19T01:00:00Z'),
    w(2, '2026-11-20T23:59:59Z'),
    w(3, '2026-11-21T00:00:00Z'),
    w(4, '2026-11-21T12:00:00Z'),
  ];
  const s = passportStats(films, watches, now);
  assert.equal(s.streak, 3);
  assert.equal(s.best, 3);
  assert.equal(s.watchedToday, false);
  assert.equal(passportStats(films, watches, now + 86400000).streak, 0);
  assert.equal(
    passportStats(films, [...watches, w(5, '2026-11-22T10:00:00Z')], now)
      .streak,
    4,
  );
});
test('UTC month and day boundaries are timezone independent; invalid/future watches do not count', () => {
  const s = passportStats(
    films,
    [
      w(1, '2026-11-01T01:00:00+03:00'),
      w(2, '2026-11-22T00:30:00+03:00'),
      w(3, 'invalid'),
      w(4, '2026-11-23T00:00:00Z'),
    ],
    now,
  );
  assert.deepEqual(
    s.monthly.map((f) => f.id),
    [2],
  );
  assert.equal(s.streak, 1);
  assert.equal(s.watchedToday, false);
  assert.equal(s.newest?.id, 2);
});
test('each unique monthly title contributes one divided genre vote; unknown genres excluded transparently', () => {
  const s = passportStats(
    [...films, films[0]],
    [
      w(1, '2026-11-10Z'),
      w(1, '2026-11-11Z'),
      w(2, '2026-11-12Z'),
      w(3, '2026-11-13Z'),
    ],
    now,
  );
  assert.equal(s.monthly.length, 3);
  assert.equal(s.classified, 2);
  assert.equal(s.genres[0].name, 'Драма');
  assert.equal(s.genres[0].percent, 75);
  assert.equal(s.genres[0].count, 2);
  assert.equal(s.genres[1].percent, 25);
  assert.equal(
    s.genres.reduce((sum, g) => sum + g.percent, 0),
    100,
  );
});
test('co-productions mark every real country; unknown historical countries are never invented', () => {
  const s = passportStats(
    films,
    [w(1, '2026-11-10Z'), w(3, '2026-11-11Z')],
    now,
  );
  assert.deepEqual([...s.countries.byCountry.keys()], ['RU', 'US']);
  assert.equal(s.countries.unmapped.length, 1);
  assert.equal(s.discovery?.id, 4);
  assert.equal(s.newest?.id, 3);
  assert.equal(
    passportStats(
      films,
      films.map((f) => w(f.id, '2026-11-21Z')),
      now,
    ).discovery,
    null,
  );
});
test('longest streak is independent from current streak, including year and leap-day boundaries', () => {
  const input = [
    w(1, '2024-02-28T01:00Z'),
    w(2, '2024-02-29T01:00Z'),
    w(3, '2024-03-01T01:00Z'),
    w(4, '2026-11-22T01:00Z'),
  ];
  const s = passportStats(films, input, now);
  assert.equal(s.best, 3);
  assert.equal(s.streak, 1);
  assert.equal(s.watchedToday, true);
  const year = passportStats(
    films,
    [w(1, '2025-12-31T01:00Z'), w(2, '2026-01-01T01:00Z')],
    Date.parse('2026-01-01T12:00Z'),
  );
  assert.equal(year.streak, 2);
});
