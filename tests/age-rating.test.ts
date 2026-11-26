import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ageRatingTone } from '../src/lib/age-rating';
test('age chips use classification colors independently of the movie score', () => {
  for (const value of ['0+', '6+']) assert.equal(ageRatingTone(value), 'green');
  for (const value of ['7+', '12+']) assert.equal(ageRatingTone(value), 'blue');
  for (const value of ['13+', '15+'])
    assert.equal(ageRatingTone(value), 'yellow');
  for (const value of ['16+', '17+'])
    assert.equal(ageRatingTone(value), 'orange');
  for (const value of ['18+', '21+']) assert.equal(ageRatingTone(value), 'red');
  assert.equal(ageRatingTone(' 18+ '), 'red');
});
test('missing and malformed age metadata has a neutral fallback, never a misleading classification', () => {
  for (const value of [
    null,
    undefined,
    '',
    'NR',
    '-1+',
    '22+',
    '999+',
    '18 years',
    '18',
    '<18+>',
  ])
    assert.equal(ageRatingTone(value), 'unknown');
});
