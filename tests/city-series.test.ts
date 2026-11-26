import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  normalizeCity,
  savedCity,
  nearbyCity,
  cinemaSearchUrl,
} from '../src/lib/city-location';
import { seriesPosterLabel } from '../src/lib/series-poster';
test('city choice normalizes names, supports manual cities outside the small index, rejects controls and markup', () => {
  assert.equal(normalizeCity('  Каменск-Уральский  '), 'Каменск-Уральский');
  assert.equal(normalizeCity('Санкт‑Петербург'), 'Санкт-Петербург');
  assert.equal(normalizeCity('Valencia, España'), 'Valencia, España');
  for (const value of [
    null,
    42,
    '',
    'A',
    '123',
    '<script>alert(1)</script>',
    'Москва\u202e',
    'https://bad.test',
    'a'.repeat(81),
  ])
    assert.equal(normalizeCity(value), '');
  assert.equal(savedCity('{"city":"Казань"}'), 'Казань');
  for (const value of [
    'broken',
    'null',
    '{}',
    '{"city":"javascript:alert(1)"}',
  ])
    assert.equal(savedCity(value), '');
});
test('offline coordinate suggestions require a nearby city and reasonable accuracy, never fabricate the closest distant city', () => {
  assert.equal(nearbyCity(56.4149, 61.9187, 100), 'Каменск-Уральский');
  assert.equal(nearbyCity(55.75, 37.61, 1500), 'Москва');
  for (const args of [
    [0, 0, 100],
    [90, 180, 100],
    [91, 0, 1],
    [55, 37, 30000],
    [NaN, 0, 0],
    [0, Infinity, 0],
    [55, 37, -1],
  ])
    assert.equal(nearbyCity(...(args as [number, number, number])), null);
});
test('cinema links are encoded outbound search, never a made-up local showtime inventory', () => {
  const url = new URL(cinemaSearchUrl('Каменск-Уральский', 'Тест & фильм')!);
  assert.equal(url.origin, 'https://yandex.ru');
  assert.equal(url.pathname, '/search/');
  assert.match(
    url.searchParams.get('text')!,
    /Каменск-Уральский Тест & фильм кинотеатры/,
  );
  assert.equal(cinemaSearchUrl('javascript:evil'), null);
});
test('only episodic categories have an edition stack; counts are real metadata, not guessed seasons', () => {
  for (const category of ['Сериал', 'Мультсериал', 'Аниме-сериал']) {
    assert.equal(seriesPosterLabel({ category })?.short, category);
    assert.equal(
      seriesPosterLabel({ category, episodes: 100, seasonCount: 2 })?.short,
      '2 сез. · 100 сер.',
    );
    assert.match(
      seriesPosterLabel({ category, episodes: 100, seasonCount: 2 })!
        .description,
      /Сезонов добавлено: 2/,
    );
  }
  for (const category of ['Фильм', 'Мультфильм', 'Аниме-фильм'])
    assert.equal(seriesPosterLabel({ category, episodes: 100 }), null);
  assert.equal(seriesPosterLabel(undefined), null);
  assert.equal(
    seriesPosterLabel({ category: 'Сериал', seasonCount: -1, episodes: 0 })
      ?.short,
    'Сериал',
  );
});
