import test from 'node:test';
import assert from 'node:assert/strict';
import { compareCinemaRatings } from '../src/lib/cinema-comparison';
const mine = [
  { movieId: 1, value: 9 },
  { movieId: 2, value: 5 },
  { movieId: 3, value: 8 },
  { movieId: 4, value: 0 },
  { movieId: 5, value: 7 },
];
const theirs = [
  { movieId: 1, value: 8, title: 'Одна история' },
  { movieId: 2, value: 9 },
  { movieId: 3, value: 8.5 },
  { movieId: 4, value: 10 },
  { movieId: 5, value: 8 },
  { movieId: 6, value: 9 },
];
test('Comparison intersects explicit positive personal ratings only', () => {
  assert.deepEqual(
    compareCinemaRatings(mine, theirs).map((p) => p.movieId),
    [2, 1, 5, 3],
  );
  assert.deepEqual(compareCinemaRatings([], theirs), []);
});
test('Comparison sorts maximum absolute gap first with deterministic ID ties', () => {
  const pairs = compareCinemaRatings(mine, theirs);
  assert.deepEqual(
    pairs.map((p) => p.gap),
    [4, 1, 1, 0.5],
  );
  assert.equal(pairs[1].title, 'Одна история');
  assert.equal(pairs[0].title, 'История #2');
});
test('Agreements require both ratings at least eight and a gap no larger than one', () => {
  assert.deepEqual(
    compareCinemaRatings(mine, theirs)
      .filter((p) => p.agreement)
      .map((p) => p.movieId),
    [1, 3],
  );
  assert.equal(
    compareCinemaRatings(
      [{ movieId: 1, value: 10 }],
      [{ movieId: 1, value: 8.5 }],
    )[0].agreement,
    false,
  );
});
test('Comparison deduplicates peers and ignores non-finite and missing ratings', () => {
  assert.equal(
    compareCinemaRatings(mine, [
      ...theirs,
      theirs[0],
      { movieId: 20, value: NaN },
    ]).length,
    4,
  );
  assert.deepEqual(
    compareCinemaRatings(
      [{ movieId: 1, value: Infinity }],
      [{ movieId: 1, value: 8 }],
    ),
    [],
  );
});
test('Comparison never mutates either source and is symmetric in gap/agreement', () => {
  const before = JSON.stringify({ mine, theirs });
  const a = compareCinemaRatings(mine, theirs),
    b = compareCinemaRatings(theirs, mine);
  assert.deepEqual(
    a.map((p) => [p.movieId, p.gap, p.agreement]),
    b.map((p) => [p.movieId, p.gap, p.agreement]),
  );
  assert.equal(JSON.stringify({ mine, theirs }), before);
});
