import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyLibraryOptions,
  selectPersonalLibrary,
  type LibraryOptions,
} from '../src/lib/personal-library';
const films = [
  {
    id: 3,
    title: 'Бета',
    originalTitle: 'Blue',
    genre: 'Драма',
    category: 'Фильм',
    year: 2020,
    rating: 9,
    ratingCount: 1,
  },
  {
    id: 1,
    title: 'Альфа',
    originalTitle: null,
    genre: 'Фантастика',
    category: 'Аниме-фильм',
    year: 2024,
    rating: 8,
    ratingCount: 2,
  },
  {
    id: 2,
    title: 'Гамма',
    originalTitle: null,
    genre: 'Драма',
    category: 'Сериал',
    year: 2024,
    rating: 10,
    ratingCount: 0,
  },
];
const watched = new Set([1]),
  ratings = new Map([
    [1, 9],
    [3, 7.5],
  ]);
const select = (options: Partial<LibraryOptions> = {}) =>
  selectPersonalLibrary(
    films,
    { ...emptyLibraryOptions, ...options },
    watched,
    ratings,
  ).map((film) => film.id);
test('the default is the supplied collection order, never a catalog fallback', () => {
  assert.deepEqual(select(), [3, 1, 2]);
  assert.deepEqual(
    selectPersonalLibrary([], { ...emptyLibraryOptions }, watched, ratings),
    [],
  );
});
test('search is trimmed/case-insensitive and includes original title and genre', () => {
  assert.deepEqual(select({ query: ' BLue ' }), [3]);
  assert.deepEqual(select({ query: 'ДРАМА' }), [3, 2]);
  assert.deepEqual(select({ query: 'unknown' }), []);
});
test('all ownership filters intersect and anime formats stay distinct', () => {
  assert.deepEqual(select({ category: 'Аниме-фильм' }), [1]);
  assert.deepEqual(select({ watch: 'unwatched', rating: 'rated' }), [3]);
  assert.deepEqual(
    select({ category: 'Сериал', watch: 'unwatched', rating: 'unrated' }),
    [2],
  );
  assert.deepEqual(select({ watch: 'watched', rating: 'unrated' }), []);
});
test('my rating sort uses the current user values, not public averages', () => {
  assert.deepEqual(select({ sort: 'mine' }), [1, 3, 2]);
  assert.deepEqual(select({ sort: 'rating' }), [3, 1, 2]);
});
test('release-year ties use IDs and alphabetical sorting is deterministic', () => {
  assert.deepEqual(select({ sort: 'year' }), [1, 2, 3]);
  assert.deepEqual(select({ sort: 'title' }), [1, 3, 2]);
});
test('sorting/filtering never mutates input and duplicate ownership counts once', () => {
  const before = structuredClone(films),
    options = { ...emptyLibraryOptions, sort: 'rating' as const };
  assert.deepEqual(
    selectPersonalLibrary([...films, films[0]], options, watched, ratings).map(
      (f) => f.id,
    ),
    [3, 1, 2],
  );
  assert.deepEqual(films, before);
  assert.equal(options.sort, 'rating');
});
test('a zero/absent personal rating is unrated regardless of community score', () => {
  const personal = new Map([[3, 0]]);
  assert.deepEqual(
    selectPersonalLibrary(
      films,
      { ...emptyLibraryOptions, rating: 'unrated' },
      watched,
      personal,
    ).map((f) => f.id),
    [3, 1, 2],
  );
});
