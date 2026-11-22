import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCountryIndex, cinemaDensity, countryCode, countryName, parseFilmCountries } from '../src/lib/cinema-countries';
import geography from '../src/data/world-map.json';

test('common Russian/English country labels, aliases and ISO codes map to the same codes', () => {
  for (const label of ['США', 'United States of America', 'US', 'USA']) assert.equal(countryCode(label), 'US');
  assert.equal(countryCode('Россия'), 'RU'); assert.equal(countryCode('Япония'), 'JP');
  assert.equal(countryCode('Южная Корея'), 'KR'); assert.equal(countryCode('UK'), 'GB');
  assert.equal(countryCode('Франция'), 'FR'); assert.equal(countryName('FR'), 'Франция');
});
test('co-productions count once per country, with meaningful compound country names intact', () => {
  assert.deepEqual(parseFilmCountries('США, США; Великобритания / Франция').codes, ['US', 'GB', 'FR']);
  assert.deepEqual(parseFilmCountries('США и Канада').codes, ['US', 'CA']);
  assert.deepEqual(parseFilmCountries('Босния и Герцеговина').codes, ['BA']);
});
test('unknown and historical country labels are never guessed from genres or assigned to successor states', () => {
  assert.deepEqual(parseFilmCountries('СССР').codes, []);
  assert.deepEqual(parseFilmCountries('Югославия').codes, []);
  assert.deepEqual(parseFilmCountries('Аниме').codes, []);
  assert.deepEqual(parseFilmCountries(null), { codes: [], unknown: [] });
  assert.deepEqual(parseFilmCountries('Франция, Атлантида'), { codes: ['FR'], unknown: ['Атлантида'] });
});
test('country index deduplicates films, keeps co-production counts and exposes missing metadata', () => {
  const result = buildCountryIndex([{ id: 1, country: 'США, Япония' }, { id: 1, country: 'США, Япония' }, { id: 2, country: 'Япония' }, { id: 3, country: null }, { id: 4, country: 'СССР' }]);
  assert.equal(result.byCountry.get('US')!.length, 1); assert.equal(result.byCountry.get('JP')!.length, 2);
  assert.deepEqual(result.unmapped.map(f => f.id), [3, 4]); assert.deepEqual(result.unknownTokens, ['СССР']);
});
test('map colors represent fixed, testable density bins', () => {
  assert.deepEqual([0, 1, 2, 3, 5, 6, 11, 12, 100].map(cinemaDensity), [0, 1, 1, 2, 2, 3, 3, 4, 4]);
});
test('committed atlas has real bounded vector geometry and the major catalog regions', () => {
  assert.equal(geography.width, 960); assert.equal(geography.height, 480); assert(geography.shapes.length > 160);
  for (const code of ['RU', 'US', 'FR', 'JP', 'KR', 'CN', 'GB', 'CA', 'BR', 'AU']) {
    const shape = geography.shapes.find(s => s.code === code); assert(shape, code); assert(shape.path.startsWith('M'), code);
    assert(shape.bounds.every(Number.isFinite));
  }
  assert.equal(geography.shapes.some(s => s.code === 'AQ'), false);
});
