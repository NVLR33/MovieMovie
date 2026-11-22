import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatFilmRating } from '../src/lib/rating-display';

test('unrated films show a dash, not a technical zero', () => {
  assert.equal(formatFilmRating({ rating: 0, ratingCount: 0 }), '—');
  assert.equal(formatFilmRating({ rating: 8, ratingCount: 0 }), '—');
});

test('rated films keep their real score, including low ratings', () => {
  assert.equal(formatFilmRating({ rating: 1, ratingCount: 1 }), '1.0');
  assert.equal(formatFilmRating({ rating: 8.56, ratingCount: 25 }), '8.6');
  assert.equal(formatFilmRating({ rating: 10, ratingCount: 1 }), '10.0');
});

test('invalid rating data never renders NaN, Infinity or zero', () => {
  for (const rating of [NaN, Infinity, -1, 0]) {
    assert.equal(formatFilmRating({ rating, ratingCount: 1 }), '—');
  }
});
