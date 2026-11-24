import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  catalogTokens,
  filterCatalog,
  parseCatalogOptions,
  catalogGenreCounts,
} from '../src/lib/catalog-filter';
const defaults = parseCatalogOptions(new URLSearchParams());
const films = [
  {
    id: 1,
    title: 'Alpha',
    originalTitle: 'Первый',
    description: 'Космос',
    category: 'Фильм',
    genre: 'Драма, Детектив',
    studio: 'Studio A, Studio B',
    director: 'Автор',
    cast: 'Актёр',
    year: 1959,
    rating: 8,
    views: 1,
    mood: 'cry',
  },
  {
    id: 2,
    title: 'Beta',
    description: '',
    category: 'Сериал',
    genre: 'Мелодрама',
    studio: 'Studio B',
    year: 1960,
    rating: 7,
    views: 2,
  },
  {
    id: 3,
    title: 'Gamma',
    description: '',
    category: 'Фильм',
    genre: 'Триллер',
    studio: 'Studio C',
    year: 2020,
    rating: 9,
    views: 3,
    mood: 'fast-paced',
  },
];
const watched = new Set([1]);
const ids = (patch: Partial<typeof defaults>) =>
  filterCatalog(films, { ...defaults, ...patch }, watched).map((f) => f.id);
test('catalog search covers title, original title, description, cast, director and trims whitespace', () => {
  for (const query of [' ALPHA ', 'Первый', 'Космос', 'Актёр', 'Автор'])
    assert.deepEqual(ids({ query }), [1]);
  assert.deepEqual(ids({ query: 'нет такого' }), []);
});
test('genre and multi-studio filters use complete trimmed tokens, not substrings', () => {
  assert.deepEqual(catalogTokens(' A, B , '), ['A', 'B']);
  assert.deepEqual(ids({ genre: 'Драма' }), [1]);
  assert.deepEqual(ids({ genre: 'мелодрама' }), [2]);
  assert.deepEqual(ids({ studio: 'Studio B' }), [2, 1]);
});
test('every precise filter intersects correctly including 1960 boundary, rating, watch status and mood', () => {
  assert.deepEqual(ids({ category: 'Фильм' }), [3, 1]);
  assert.deepEqual(ids({ year: 'before1960' }), [1]);
  assert.deepEqual(ids({ year: '1960' }), [2]);
  assert.deepEqual(ids({ minRating: '8' }), [3, 1]);
  assert.deepEqual(ids({ minRating: '9' }), [3]);
  assert.deepEqual(ids({ watchFilter: 'watched' }), [1]);
  assert.deepEqual(ids({ watchFilter: 'unwatched' }), [3, 2]);
  assert.deepEqual(
    ids({
      studio: 'Studio B',
      genre: 'Драма',
      mood: 'tears',
      minRating: '8',
      year: '1959',
      category: 'Фильм',
      watchFilter: 'watched',
    }),
    [1],
  );
  assert.deepEqual(ids({ mood: 'night' }), []);
});
test('all four sort orders are deterministic and do not mutate source', () => {
  const before = structuredClone(films);
  assert.deepEqual(ids({ sort: 'popular' }), [3, 2, 1]);
  assert.deepEqual(ids({ sort: 'rating' }), [3, 1, 2]);
  assert.deepEqual(ids({ sort: 'new' }), [3, 2, 1]);
  assert.deepEqual(ids({ sort: 'old' }), [1, 2, 3]);
  assert.deepEqual(films, before);
});
test('catalog URL state is validated and all supported controls can be linked directly', () => {
  assert.deepEqual(
    parseCatalogOptions(
      new URLSearchParams(
        'category=invalid&sort=bad&year=9999&watch=bad&minRating=NaN&mood=bad',
      ),
    ),
    defaults,
  );
  const state = parseCatalogOptions(
    new URLSearchParams(
      'category=Фильм&studio=Studio+B&genre=Драма&year=before1960&sort=old&watch=watched&minRating=8&mood=cry&search=Alpha',
    ),
  );
  assert.deepEqual(state, {
    ...defaults,
    category: 'Фильм',
    studio: 'Studio B',
    genre: 'Драма',
    year: 'before1960',
    sort: 'old',
    watchFilter: 'watched',
    minRating: '8',
    mood: 'tears',
    query: 'Alpha',
  });
});

test('genre tile counts honor other conditions but do not restrict alternate genres', () => {
  const counts = catalogGenreCounts(
    films,
    { ...defaults, genre: 'Триллер', category: 'Фильм' },
    watched,
  );
  assert.equal(counts.total, 2);
  assert.equal(counts.counts.get('драма'), 1);
  assert.equal(counts.counts.get('детектив'), 1);
  assert.equal(counts.counts.get('триллер'), 1);
  assert.equal(counts.counts.get('мелодрама') ?? 0, 0);
  assert.deepEqual(
    counts,
    catalogGenreCounts(films, { ...defaults, category: 'Фильм' }, watched),
  );
});
test('genre counts handle search, editorial mood, studio, year, rating and watch intersection', () => {
  const counts = catalogGenreCounts(
    films,
    {
      ...defaults,
      query: 'Автор',
      mood: 'tears',
      studio: 'Studio A',
      year: 'before1960',
      minRating: '8',
      watchFilter: 'watched',
    },
    watched,
  );
  assert.equal(counts.total, 1);
  assert.equal(counts.counts.get('драма'), 1);
  assert.equal(counts.counts.get('триллер') ?? 0, 0);
  const empty = catalogGenreCounts(
    films,
    { ...defaults, query: 'not in this catalog' },
    watched,
  );
  assert.equal(empty.total, 0);
  assert.equal(empty.counts.size, 0);
});
test('genre facets count each title once, case-insensitively and by exact token', () => {
  const counts = catalogGenreCounts(
    [{ ...films[0], genre: ' Драма, ДРАМА, Мелодрама, , Детектив ' }],
    defaults,
    watched,
  );
  assert.equal(counts.total, 1);
  assert.equal(counts.counts.get('драма'), 1);
  assert.equal(counts.counts.get('мелодрама'), 1);
  assert.equal(counts.counts.get('детектив'), 1);
  assert.equal(counts.counts.size, 3);
});
