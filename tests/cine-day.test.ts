import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogDayTags, randomCatalogDay } from '../src/lib/cine-day';
import { filterCatalog, parseCatalogOptions } from '../src/lib/catalog-filter';
const film = (id: number, genre: string) => ({
  id,
  title: `Title ${id}`,
  description: '',
  category: 'Фильм',
  genre,
  year: 2024,
  rating: 8,
  views: 0,
});
test('daily tags come only from current comma-separated genres, deduplicated per title and case-insensitively', () => {
  const tags = catalogDayTags([
    film(1, ' Драма, Комедия, драма '),
    film(2, 'Драма, Семейный'),
    film(3, ''),
    film(4, 'Все жанры'),
  ]);
  assert.deepEqual(
    tags.map((t) => [t.filter, t.count]),
    [
      ['Драма', 2],
      ['Комедия', 1],
      ['Семейный', 1],
    ],
  );
  assert.deepEqual(catalogDayTags([]), []);
  assert.equal(randomCatalogDay([]), null);
});
test('every generated link opens nonempty exact-genre results, even with URL-special characters and overlapping tag names', () => {
  const films = [
    film(1, 'Фантастика, Научная фантастика'),
    film(2, 'Научная фантастика'),
    film(3, 'Арт & кино + #1?'),
    film(4, 'Драма'),
  ];
  for (const tag of catalogDayTags(films)) {
    const url = new URL(tag.href, 'https://example.test');
    assert.equal(url.pathname, '/catalog');
    assert.equal(url.searchParams.get('search'), null);
    assert.equal(url.searchParams.get('genre'), tag.filter);
    const matches = filterCatalog(
      films,
      parseCatalogOptions(url.searchParams),
      new Set(),
    );
    assert.equal(matches.length, tag.count);
    assert(matches.length > 0);
  }
});
test('random selection covers actual tags, never immediately repeats when alternatives exist and handles single tags', () => {
  const tags = catalogDayTags([film(1, 'Драма, Комедия, Триллер')]);
  assert.equal(
    randomCatalogDay(tags, undefined, () => 0),
    tags[0],
  );
  assert.equal(
    randomCatalogDay(tags, undefined, () => 0.5),
    tags[1],
  );
  assert.equal(
    randomCatalogDay(tags, undefined, () => 0.99),
    tags[2],
  );
  for (const value of [0, 0.5, 0.99])
    assert.notEqual(
      randomCatalogDay(tags, 'Комедия', () => value)?.filter,
      'Комедия',
    );
  assert.equal(randomCatalogDay(tags.slice(0, 1), 'Драма'), tags[0]);
});
test('removed genres cannot remain in a refreshed suggestion pool', () => {
  const before = catalogDayTags([film(1, 'Драма'), film(2, 'Триллер')]);
  assert.equal(before.length, 2);
  const after = catalogDayTags([film(1, 'Драма')]);
  assert.equal(randomCatalogDay(after, 'Триллер')?.filter, 'Драма');
});
