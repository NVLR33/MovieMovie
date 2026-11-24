import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveSeason,
  seasonLink,
  seasonNumber,
  seasonStorageKey,
} from '../src/lib/season-navigation';
import type { SeriesSeason } from '../src/lib/series';
const seasons: SeriesSeason[] = [
  { id: 42, number: 1, title: 'Начало', rating: null, episodes: [] },
  { id: 85, number: 3, title: 'Финал', rating: 8, episodes: [] },
];
test('only explicit canonical season numbers 1–100 are accepted', () => {
  for (const raw of [
    null,
    '',
    '0',
    '-1',
    '01',
    '1.5',
    '1e1',
    ' 2',
    '2 ',
    'NaN',
    '101',
    '1000',
  ])
    assert.equal(seasonNumber(raw), null);
  assert.equal(seasonNumber('1'), 1);
  assert.equal(seasonNumber('100'), 100);
});
test('direct season links override local choice without treating number as database ID', () => {
  assert.equal(resolveSeason(seasons, '3', '42')?.id, 85);
  assert.equal(resolveSeason(seasons, '85', null)?.id, 42);
});
test('local preference works without a link and survives season renumbering', () => {
  assert.equal(resolveSeason(seasons, null, '85')?.number, 3);
  assert.equal(
    resolveSeason([{ ...seasons[1], number: 4 }], null, '85')?.number,
    4,
  );
});
test('invalid, missing and deleted selections safely fall back, including sparse seasons', () => {
  assert.equal(resolveSeason(seasons, '2', '85')?.number, 3);
  assert.equal(resolveSeason(seasons, '<script>', 'missing')?.id, 42);
  assert.equal(resolveSeason([], '1', '42'), null);
});
test('shareable link preserves route/other filters and targets the season section', () => {
  const url = new URL(
    seasonLink('https://movie.test/movie/7?from=catalog&season=1#old', 3),
  );
  assert.equal(url.pathname, '/movie/7');
  assert.equal(url.searchParams.get('from'), 'catalog');
  assert.deepEqual(url.searchParams.getAll('season'), ['3']);
  assert.equal(url.hash, '#series-seasons');
});
test('remembered choices are isolated per material and account, not progress records', () => {
  assert.notEqual(seasonStorageKey(7, 1), seasonStorageKey(7, 2));
  assert.notEqual(seasonStorageKey(7, 1), seasonStorageKey(8, 1));
  assert.notEqual(seasonStorageKey(7, null), seasonStorageKey(7, 1));
});
