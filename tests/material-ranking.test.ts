import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MATERIAL_CATEGORIES, MATERIAL_TOP_LIMITS, materialTopUrl, parseMaterialTopOptions, rankMaterials, type MaterialTopOptions } from '../src/lib/material-ranking';

const defaults: MaterialTopOptions = { metric: 'rating', limit: 10, category: 'Все' };
const materials = Array.from({ length: 150 }, (_, i) => ({
  id: i + 1, category: i % 2 ? 'Фильм' : 'Аниме-сериал', rating: 5 + i / 100, ratingCount: 1, views: 150 - i,
}));

test('material top offers exactly 10, 50 and 100 and defaults to top 10 by rating', () => {
  assert.deepEqual(MATERIAL_TOP_LIMITS, [10, 50, 100]);
  assert.deepEqual(parseMaterialTopOptions(new URLSearchParams()), defaults);
});

for (const limit of MATERIAL_TOP_LIMITS) {
  test(`top ${limit} sorts the whole catalog before limiting, with independent metrics`, () => {
    const rating = rankMaterials(materials, { ...defaults, limit });
    const views = rankMaterials(materials, { ...defaults, limit, metric: 'views' });
    assert.equal(rating.eligibleCount, 150);
    assert.equal(rating.materials.length, limit);
    assert.equal(rating.materials[0].id, 150);
    assert.equal(rating.materials.at(-1)?.id, 151 - limit);
    assert.equal(views.materials[0].id, 1);
    assert.equal(views.materials.at(-1)?.id, limit);
  });
}

test('filters category before applying the limit and ranks within the selected category', () => {
  const result = rankMaterials(materials, { ...defaults, category: 'Фильм' });
  assert.equal(result.eligibleCount, 75);
  assert.equal(result.materials.length, 10);
  assert.equal(result.materials.every(material => material.category === 'Фильм'), true);
  assert.deepEqual(result.materials.slice(0, 3).map(material => material.id), [150, 148, 146]);
});

test('all six content categories are supported and empty categories stay empty', () => {
  assert.equal(MATERIAL_CATEGORIES.length, 7);
  for (const category of MATERIAL_CATEGORIES.slice(1)) {
    const result = rankMaterials([{ ...materials[0], category }], { ...defaults, category });
    assert.equal(result.materials.length, 1);
  }
  assert.deepEqual(rankMaterials(materials, { ...defaults, category: 'Мультсериал' }), { eligibleCount: 0, materials: [] });
});

test('unrated titles do not compete by rating; unwatched titles do not compete by views', () => {
  const input = [
    { ...materials[0], id: 1, rating: 10, ratingCount: 0, views: 3 },
    { ...materials[0], id: 2, rating: 9, ratingCount: 1, views: null },
    { ...materials[0], id: 3, rating: 0, ratingCount: 0, views: 0 },
  ];
  assert.deepEqual(rankMaterials(input, defaults).materials.map(item => item.id), [2]);
  assert.deepEqual(rankMaterials(input, { ...defaults, metric: 'views' }).materials.map(item => item.id), [1]);
});

test('rating ties resolve by votes, views and stable id without mutating inputs', () => {
  const input = [
    { ...materials[0], id: 4, ratingCount: 10, views: 50 },
    { ...materials[0], id: 2, ratingCount: 10, views: 50 },
    { ...materials[0], id: 1, ratingCount: 10, views: 100 },
    { ...materials[0], id: 3, ratingCount: 11, views: 1 },
  ];
  const before = structuredClone(input);
  assert.deepEqual(rankMaterials(input, defaults).materials.map(item => item.id), [3, 1, 2, 4]);
  assert.deepEqual(input, before);
});

test('view ties resolve by rating, votes and stable id', () => {
  const input = [
    { ...materials[0], id: 4, views: 50, rating: 7, ratingCount: 1 },
    { ...materials[0], id: 2, views: 50, rating: 7, ratingCount: 2 },
    { ...materials[0], id: 1, views: 50, rating: 7, ratingCount: 2 },
    { ...materials[0], id: 3, views: 50, rating: 8, ratingCount: 1 },
  ];
  assert.deepEqual(rankMaterials(input, { ...defaults, metric: 'views' }).materials.map(item => item.id), [3, 1, 2, 4]);
});

test('fewer than the requested number returns real entries without placeholders', () => {
  const result = rankMaterials(materials.slice(0, 3), { ...defaults, limit: 100 });
  assert.equal(result.materials.length, 3);
  assert.equal(result.eligibleCount, 3);
  assert.deepEqual(rankMaterials([], defaults), { materials: [], eligibleCount: 0 });
});

test('URL options roundtrip, including Cyrillic categories, and invalid params fall back safely', () => {
  for (const category of MATERIAL_CATEGORIES) {
    const options: MaterialTopOptions = { category, limit: 100, metric: 'views' };
    assert.deepEqual(parseMaterialTopOptions(new URL(materialTopUrl(options), 'https://example.test').searchParams), options);
  }
  for (const invalid of ['metric=wrong&category=unknown&limit=999', 'limit=-10', 'limit=10junk', 'limit=']) {
    assert.deepEqual(parseMaterialTopOptions(new URLSearchParams(invalid)), defaults);
  }
});

test('favorites rank current user counts, exclude zero/missing counts and keep stable ties', () => {
  const input = [
    { ...materials[0], id: 6, favoriteCount: 1, rating: 10 },
    { ...materials[0], id: 5, favoriteCount: 5, rating: 7, ratingCount: 2, views: 8 },
    { ...materials[0], id: 4, favoriteCount: 5, rating: 8, ratingCount: 1, views: 8 },
    { ...materials[0], id: 3, favoriteCount: 5, rating: 8, ratingCount: 2, views: 8 },
    { ...materials[0], id: 2, favoriteCount: 5, rating: 8, ratingCount: 2, views: 9 },
    { ...materials[0], id: 1, favoriteCount: 5, rating: 8, ratingCount: 2, views: 9 },
    { ...materials[0], id: 7, favoriteCount: 0 },
    { ...materials[0], id: 8 },
    { ...materials[0], id: 9, favoriteCount: NaN },
  ];
  const before = structuredClone(input);
  const result = rankMaterials(input, { ...defaults, metric: 'favorites' });
  assert.deepEqual(result.materials.map(item => item.id), [1, 2, 3, 4, 5, 6]);
  assert.equal(result.eligibleCount, 6);
  assert.deepEqual(input, before);
  assert.deepEqual(rankMaterials(input, { ...defaults, metric: 'favorites', category: 'Фильм' }).materials, []);
});

test('favorites supports category/size URL roundtrip and ranks before slicing', () => {
  for (const limit of MATERIAL_TOP_LIMITS) {
    const options: MaterialTopOptions = { metric: 'favorites', category: 'Фильм', limit };
    assert.deepEqual(parseMaterialTopOptions(new URL(materialTopUrl(options), 'https://example.test').searchParams), options);
    const ranked = rankMaterials(materials.map(item => ({ ...item, favoriteCount: item.id })), options);
    assert.equal(ranked.eligibleCount, 75);
    assert.equal(ranked.materials.length, Math.min(limit, 75));
    assert.equal(ranked.materials[0].id, 150);
  }
});
