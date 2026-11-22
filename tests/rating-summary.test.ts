import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeRatings } from '../src/lib/rating-summary';

test('empty ratings produce an empty lookup', () => {
  assert.equal(summarizeRatings([]).size, 0);
});

test('weighted groups preserve half-star histogram, count and rounded average', () => {
  const summary = summarizeRatings([
    { movieId: 1, value: 7.5, count: 2 },
    { movieId: 2, value: 10, count: 1 },
    { movieId: 1, value: 8, count: 1 },
  ]);
  assert.deepEqual(summary.get(1), { count: 3, sum: 23, average: 7.7, dist: { '7.5': 2, '8': 1 } });
  assert.equal(summary.get(2)?.average, 10);
  assert.equal(summary.get(3), undefined);
});

test('grouped aggregation matches raw rating aggregation', () => {
  const grouped = [
    { movieId: 1, value: 0.5, count: 6 },
    { movieId: 1, value: 10, count: 3 },
    { movieId: 2, value: 4.5, count: 2 },
  ];
  const raw = grouped.flatMap(row => Array.from({ length: row.count }, () => ({ ...row, count: 1 })));
  assert.deepEqual(summarizeRatings(grouped), summarizeRatings(raw));
});
