import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PET_ACTIVITY, PET_CARE, PET_LEVEL_XP, PET_STAGE_LEVELS, PET_ITEMS, PET_UPGRADES, parseOwnedItems, petDay, petProduction, petProgress, petStageName } from '../src/lib/cinema-pet';

test('pet has twelve levels, six forms and no negative or reset progression', () => {
  assert.equal(PET_LEVEL_XP.length, 12); assert.equal(PET_STAGE_LEVELS.length, 6);
  assert(PET_LEVEL_XP.every((xp, i) => !i || xp > PET_LEVEL_XP[i - 1]));
  for (let i = 0; i < PET_LEVEL_XP.length; i++) assert.equal(petProgress(PET_LEVEL_XP[i]).level, i + 1);
  assert.equal(petProgress(-20).level, 1); assert.equal(petProgress(Number.NaN).percentage, 0);
  assert.equal(petProgress(100000).level, 12); assert.equal(petProgress(100000).percentage, 100);
});
test('final branches are genuinely different forms, not random rewards', () => {
  assert.equal(petStageName(3500, 'director'), 'Режиссёр легенд');
  assert.equal(petStageName(3500, 'monster'), 'Кино-монстр');
  assert.equal(petStageName(0, 'monster'), 'Зёрнышко');
});
test('idle production is deterministic and capped to twenty-four hours', () => {
  const now = new Date('2026-11-22T12:00:00Z');
  assert.deepEqual(petProduction('2026-11-22T09:00:00Z', 0, now), { rate: 2, pending: 6, capacity: 48 });
  assert.deepEqual(petProduction('2020-01-01T00:00:00Z', 5, now), { rate: 7, pending: 168, capacity: 168 });
  assert.equal(petProduction(null, 5, now).pending, 0);
  assert.equal(petProduction('invalid', 0, now).pending, 0);
  assert.equal(petProduction('2030-01-01T00:00:00Z', 5, now).pending, 0);
});
test('sub-hour income never rounds up and upgrades remain bounded', () => {
  const now = new Date('2026-11-22T12:00:00Z');
  assert.equal(petProduction('2026-11-22T11:31:00Z', 0, now).pending, 0);
  assert.equal(petProduction('2026-11-22T11:30:00Z', 0, now).pending, 1);
  assert.equal(petProduction('2026-11-22T11:00:00Z', 100, now).pending, 7);
  assert.equal(PET_UPGRADES.projector.prices.length, 5); assert.equal(PET_UPGRADES.archive.prices.length, 3);
});
test('activity rewards have explicit daily limits and care never prints currency', () => {
  assert.deepEqual(Object.keys(PET_ACTIVITY).sort(), ['catalog', 'rate', 'review', 'watch']);
  assert.equal(Object.values(PET_ACTIVITY).reduce((sum, p) => sum + p.popcorn * p.dailyLimit, 0), 105);
  assert(Object.values(PET_CARE).every(p => p.cost > 0 && p.xp > 0));
  assert(PET_ITEMS.every(p => p.price > 0));
  assert.equal(new Set(PET_ITEMS.map(p => p.id)).size, PET_ITEMS.length);
});
test('daily mission boundary is UTC, not browser timezone', () => {
  assert.equal(petDay(new Date('2026-11-23T04:59:59+05:00')), '2026-11-22');
  assert.equal(petDay(new Date('2026-11-23T05:00:00+05:00')), '2026-11-23');
});
test('owned cosmetic parsing cannot inject arbitrary equipment or duplicate items', () => {
  assert.deepEqual(parseOwnedItems('["accessory:crown","accessory:crown","script:bad",123]'), ['accessory:crown']);
  assert.deepEqual(parseOwnedItems('{"theme":"cosmic"}'), []);
  assert.deepEqual(parseOwnedItems('broken'), []);
});
