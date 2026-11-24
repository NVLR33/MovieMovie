import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWeeklyPulse,
  rankWeeklyPulse,
  pulsePeriod,
} from '../src/lib/weekly-pulse';
const now = new Date('2026-11-22T12:00:00Z'),
  films = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    rating: 8,
    ratingCount: 1,
  }));
const watch = (
  movieId: number,
  userId: number,
  watchedAt: string | Date = now,
) => ({ movieId, userId, watchedAt });
test('pulse counts unique viewers per material, not repeated sessions or all-time votes', () => {
  const pulse = buildWeeklyPulse(
    films,
    [watch(1, 1), watch(1, 1), watch(1, 2), watch(2, 1)],
    now,
  );
  assert.deepEqual(pulse.entries, [
    { movieId: 1, viewers: 2 },
    { movieId: 2, viewers: 1 },
  ]);
  assert.equal(
    pulse.entries.some((entry) => entry.movieId === 3),
    false,
  );
});
test('rolling seven days include both boundaries, exclude old/future/invalid watches', () => {
  const since = pulsePeriod(now).since;
  const pulse = buildWeeklyPulse(
    films,
    [
      watch(1, 1, since),
      watch(1, 2, now),
      watch(2, 1, '2026-11-15T11:59:59.999Z'),
      watch(3, 1, '2026-11-22T12:00:00.001Z'),
      watch(4, 1, 'invalid'),
    ],
    now,
  );
  assert.deepEqual(pulse.entries, [{ movieId: 1, viewers: 2 }]);
  assert.equal(pulse.since, '2026-11-15T12:00:00.000Z');
  assert.equal(pulse.until, now.toISOString());
});
test('same viewer can count in different titles; orphaned materials never appear', () => {
  assert.deepEqual(
    buildWeeklyPulse(films, [watch(1, 1), watch(2, 1), watch(999, 2)], now)
      .entries,
    [
      { movieId: 1, viewers: 1 },
      { movieId: 2, viewers: 1 },
    ],
  );
});
test('ties use real rating then votes then ID; unrated fake ten does not beat a genuine score', () => {
  const data = [
    { id: 1, rating: 10, ratingCount: 0 },
    { id: 2, rating: 9, ratingCount: 1 },
    { id: 3, rating: 9, ratingCount: 2 },
    { id: 4, rating: 9, ratingCount: 2 },
  ];
  assert.deepEqual(
    rankWeeklyPulse(
      data,
      data.map((film) => ({ movieId: film.id, viewers: 1 })),
      now,
    ).entries.map((entry) => entry.movieId),
    [3, 4, 2, 1],
  );
});
test('public result has only ten actual aggregate records and safe positive counts', () => {
  const counts = films.map((film) => ({ movieId: film.id, viewers: film.id }));
  counts.push(
    { movieId: 999, viewers: 90 },
    { movieId: 1, viewers: NaN },
    { movieId: 2, viewers: -1 },
  );
  const result = rankWeeklyPulse(films, counts, now);
  assert.equal(result.entries.length, 10);
  assert.equal(result.entries[0].movieId, 12);
  assert.deepEqual(Object.keys(result.entries[0]), ['movieId', 'viewers']);
  assert.deepEqual(Object.keys(result).sort(), ['entries', 'since', 'until']);
});
test('empty week stays empty, no fake top filled from all-time catalog', () => {
  assert.deepEqual(buildWeeklyPulse(films, [], now).entries, []);
  assert.deepEqual(buildWeeklyPulse([], [watch(1, 1)], now).entries, []);
});
