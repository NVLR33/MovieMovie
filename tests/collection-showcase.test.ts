import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCinemaCollections,
  filterCinemaCollections,
  collectionShowcaseUrl,
  type CollectionFilm,
} from '../src/lib/collection-showcase';
const film = (
  id: number,
  patch: Partial<CollectionFilm> = {},
): CollectionFilm => ({
  id,
  title: `Фильм ${id}`,
  genre: 'Драма',
  studio: 'A24',
  cast: 'Актёр Один',
  year: 2020,
  rating: 8,
  ratingCount: 1,
  views: 1,
  backdrop: null,
  ...patch,
});
test('collections use exact credited tokens, normalize casing/whitespace/ё, deduplicate film IDs and tokens', () => {
  const first = film(1, {
    studio: 'A24; A24\nStudio B',
    genre: 'Драма, драма',
    cast: 'Актёр  Один; актер один',
  });
  const groups = buildCinemaCollections([
    first,
    first,
    film(2, { studio: 'a24', cast: 'АКТЕР ОДИН' }),
    film(3, {
      studio: 'A240',
      cast: 'Другой Актёр',
      genre: 'Драматический триллер',
    }),
  ]);
  const a24 = groups.find((group) => group.key === 'studio:a24')!;
  assert.deepEqual(
    a24.films.map((film) => film.id),
    [1, 2],
  );
  assert.equal(
    groups.find((group) => group.key === 'studio:a240')?.films.length,
    1,
  );
  assert.equal(
    groups.find((group) => group.key === 'actor:актер один')?.films.length,
    2,
  );
  assert.equal(
    groups.find((group) => group.key === 'genre:драма')?.films.length,
    2,
  );
});
test('unknown metadata is skipped, missing studios/cast do not fabricate collections', () => {
  const groups = buildCinemaCollections([
    film(1, { studio: null, cast: 'unknown', genre: '' }),
    film(2, { studio: '—', cast: 'не указано', genre: 'N/A' }),
  ]);
  assert.deepEqual(groups, []);
  assert.deepEqual(buildCinemaCollections([]), []);
});
test('inside a collection genuine rated titles come first; sort is deterministic and source untouched', () => {
  const films = [
    film(1, { rating: 10, ratingCount: 0 }),
    film(2, { rating: 9, views: 3, backdrop: '/backdrop.jpg' }),
    film(3, { rating: 8, views: 99 }),
    film(4, { rating: 9, views: 3 }),
  ];
  const group = buildCinemaCollections(films).find(
    (group) => group.kind === 'studio',
  )!;
  assert.deepEqual(
    group.films.map((film) => film.id),
    [2, 4, 3, 1],
  );
  assert.equal(group.backdrop, '/backdrop.jpg');
  assert.deepEqual(
    films.map((film) => film.id),
    [1, 2, 3, 4],
  );
});
test('collection filtering searches names, not arbitrary matching plots or cast substrings across films', () => {
  const groups = buildCinemaCollections([
    film(1),
    film(2, { studio: 'Studio B', cast: 'Другое Имя', genre: 'Комедия' }),
  ]);
  assert.equal(filterCinemaCollections(groups, 'studio', 'a24').length, 1);
  assert.equal(
    filterCinemaCollections(groups, 'actor', 'АКТЕР ОДИН').length,
    1,
  );
  assert.equal(filterCinemaCollections(groups, 'genre', 'a24').length, 0);
  assert.equal(
    filterCinemaCollections(groups, 'all', 'несуществующее').length,
    0,
  );
});
test('deep links round-trip unicode names, symbols and category without interpolating unsafe URLs', () => {
  const key = 'studio:студия a & b / кино?';
  const url = new URL(
    collectionShowcaseUrl('studio', key),
    'https://example.test',
  );
  assert.equal(url.pathname, '/collab');
  assert.equal(url.searchParams.get('collection'), key);
  assert.equal(url.searchParams.get('view'), 'studio');
  assert.equal(collectionShowcaseUrl('bad'), '/collab');
  assert.equal(collectionShowcaseUrl('personal'), '/collab?view=personal');
});
