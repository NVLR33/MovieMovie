import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATALOG_MOODS, matchesCatalogMood, parseCatalogMood } from '../src/lib/catalog-moods';

test('catalog moods are validated, and all accepts missing metadata', () => {
  assert.equal(parseCatalogMood('invalid'), 'all');
  assert.equal(parseCatalogMood(null), 'all');
  for (const mood of CATALOG_MOODS) assert.equal(parseCatalogMood(mood.id), mood.id);
  assert(matchesCatalogMood({ genre: '' }, 'all'));
});
test('editorial mood takes precedence; genre fallback is used only without mood', () => {
  assert(matchesCatalogMood({ mood: 'night', genre: 'Комедия' }, 'night'));
  assert(!matchesCatalogMood({ mood: 'night', genre: 'Комедия' }, 'popcorn'));
  assert(matchesCatalogMood({ mood: 'Эстетика ночи', genre: 'Драма' }, 'night'));
  assert(!matchesCatalogMood({ mood: 'Эстетика ночи', genre: 'Драма' }, 'tears'));
  assert(matchesCatalogMood({ mood: '  ', genre: 'Драма' }, 'tears'));
  assert(matchesCatalogMood({ genre: 'Sci-fi, Thriller' }, 'mind'));
  assert(matchesCatalogMood({ genre: 'Приключения' }, 'popcorn'));
  assert(matchesCatalogMood({ genre: 'Ужасы' }, 'grip'));
  assert(!matchesCatalogMood({ genre: 'Комедия' }, 'night'));
});

test('existing editorial mood values remain usable without rewriting movie records', () => {
  assert.equal(parseCatalogMood('cry'), 'tears');
  assert.equal(parseCatalogMood('mind-blowing'), 'mind');
  assert.equal(parseCatalogMood('fast-paced'), 'grip');
  assert(matchesCatalogMood({ mood: 'cry', genre: 'Комедия' }, 'tears'));
  assert(matchesCatalogMood({ mood: 'fast-paced', genre: 'Драма' }, 'grip'));
  assert(matchesCatalogMood({ mood: 'cozy', genre: 'Драма' }, 'cozy'));
  assert(!matchesCatalogMood({ mood: 'cozy', genre: 'Драма' }, 'tears'));
});
