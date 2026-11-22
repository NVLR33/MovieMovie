import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getWeeklyLeaders } from '../src/lib/weekly-leaderboard';

const now = new Date('2026-11-22T12:00:00Z');
const people = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, username: `Viewer ${i + 1}`, avatar: null, xp: i * 500 }));
const watch = (userId: number, watchedAt: string = now.toISOString()) => ({ userId, watchedAt });

test('weekly top ranks the entire community by recent views before taking three', () => {
  const watches = [watch(1), watch(2), watch(2), watch(3), watch(4), watch(4), watch(4), watch(5), watch(5)];
  const before = structuredClone(watches);
  assert.deepEqual(getWeeklyLeaders(people, watches, now).map(p => [p.id, p.watches]), [[4, 3], [2, 2], [5, 2]]);
  assert.deepEqual(watches, before);
});

test('only the last seven days count, including the boundary and excluding future or invalid dates', () => {
  const watches = [watch(1, '2026-11-15T12:00:00Z'), watch(1, '2026-11-15T11:59:59Z'), watch(2, '2026-11-22T12:00:01Z'), watch(3, 'invalid'), watch(4)];
  assert.deepEqual(getWeeklyLeaders(people, watches, now).map(p => [p.id, p.watches]), [[1, 1], [4, 1]]);
});

test('inactive or removed users are not padded into the preview', () => {
  assert.deepEqual(getWeeklyLeaders(people, [], now), []);
  assert.deepEqual(getWeeklyLeaders([], [watch(1)], now), []);
  assert.deepEqual(getWeeklyLeaders(people, [watch(99), watch(5)], now).map(p => p.id), [5]);
});

test('weekly order is unrelated to lifetime XP and levels follow 500 XP per level', () => {
  const result = getWeeklyLeaders(people, [watch(1), watch(1), watch(5)], now);
  assert.deepEqual(result.map(p => [p.id, p.level]), [[1, 1], [5, 5]]);
  assert.equal(getWeeklyLeaders([{ ...people[0], xp: null }], [watch(1)], now)[0].level, 1);
});

test('public preview exposes no emails, XP totals, or watch history', () => {
  const person = { ...people[0], avatar: '/avatar.jpg', email: 'private@example.test' };
  assert.deepEqual(getWeeklyLeaders([person], [watch(1)], now), [{ id: 1, username: 'Viewer 1', avatar: '/avatar.jpg', level: 1, watches: 1 }]);
});

test('equivalent offset timestamps are independent of the server time zone', () => {
  assert.equal(getWeeklyLeaders(people, [watch(1, '2026-11-15T17:00:00+05:00')], now).length, 1);
});
