import assert from 'node:assert/strict';
import { test } from 'node:test';
import { qualifiesForCounterCurrent, trophyCalendar, validTrophyTimeZone } from '../src/lib/hidden-achievement-rules';
import { visibleHiddenTrophies } from '../src/lib/hidden-achievements';
import { selectCinemaCrown } from '../src/lib/cinema-card';
import { getOwnershipStats } from '../src/lib/ownership';

test('time zones are validated on the server with a predictable UTC fallback', () => {
  assert.equal(validTrophyTimeZone('Asia/Yekaterinburg'), 'Asia/Yekaterinburg');
  for (const value of [undefined, null, 3, '', 'bad/timezone', '<script>', 'a'.repeat(101)]) {
    assert.equal(validTrophyTimeZone(value), 'UTC');
  }
});

for (const [time, expected] of [['02:59:59', false], ['03:00:00', true], ['04:59:59', true], ['05:00:00', false]] as const) {
  test(`night watch boundary ${time} is ${expected}`, () => {
    const { hour } = trophyCalendar(new Date(`2026-11-22T${time}Z`), 'UTC');
    assert.equal(hour >= 3 && hour < 5, expected);
  });
}

test('the server instant maps to the user zone, including the previous UTC date', () => {
  assert.deepEqual(trophyCalendar(new Date('2026-11-22T22:30:00Z'), 'Asia/Yekaterinburg'), { hour: 3, weekKey: '2026-11-23' });
  assert.deepEqual(trophyCalendar(new Date('2026-11-23T00:30:00Z'), 'America/New_York'), { hour: 19, weekKey: '2026-11-16' });
});

test('calendar weeks use Monday through Sunday, including year boundaries', () => {
  assert.equal(trophyCalendar(new Date('2026-11-22T23:59:59Z'), 'UTC').weekKey, '2026-11-16');
  assert.equal(trophyCalendar(new Date('2026-11-23T00:00:00Z'), 'UTC').weekKey, '2026-11-23');
  assert.equal(trophyCalendar(new Date('2027-01-01T01:00:00Z'), 'UTC').weekKey, '2026-12-28');
});

test('DST changes do not split the same calendar week', () => {
  const before = trophyCalendar(new Date('2026-11-01T05:30:00Z'), 'America/New_York');
  const after = trophyCalendar(new Date('2026-11-01T06:30:00Z'), 'America/New_York');
  assert.equal(before.weekKey, after.weekKey);
  assert.equal(before.hour, 1);
  assert.equal(after.hour, 1);
});

test('counter-current requires 10, at least one other vote, and an unrounded mean strictly below 4', () => {
  assert.equal(qualifiesForCounterCurrent(10, { count: 3, average: 3.9999 }), true);
  assert.equal(qualifiesForCounterCurrent(10, { count: 3, average: 4 }), false);
  assert.equal(qualifiesForCounterCurrent(10, { count: 0, average: null }), false);
  assert.equal(qualifiesForCounterCurrent(9.5, { count: 1, average: 1 }), false);
  assert.equal(qualifiesForCounterCurrent(10, { count: 1, average: Number.NaN }), false);
  assert.equal(qualifiesForCounterCurrent(10, { count: 1, average: 2 }, 10), false);
  assert.equal(qualifiesForCounterCurrent(10, { count: 1, average: 2 }, 4), true);
});

test('there are no leaked names, descriptions, totals or locked IDs before unlocking', () => {
  const counts = [
    { achievementId: 'night_watch', count: 2 },
    { achievementId: 'against_the_current', count: 1 },
    { achievementId: 'steady_week', count: 3 },
  ];
  assert.deepEqual(visibleHiddenTrophies([], counts, 100), []);
  const own = visibleHiddenTrophies([{ achievementId: 'night_watch', unlockedAt: new Date('2026-11-22T22:00:00Z'), timeZone: 'Asia/Yekaterinburg' }], counts, 100);
  assert.equal(own.length, 1);
  assert.equal(own[0].name, 'Ночной дозор');
  assert.equal(own[0].community.percentage, 2);
  assert.equal(JSON.stringify(own).includes('against_the_current'), false);
  assert.equal(JSON.stringify(own).includes('Стабильность'), false);
});

test('unknown persisted achievement keys do not serialize uncontrolled definitions', () => {
  assert.deepEqual(visibleHiddenTrophies([{ achievementId: '__proto__', unlockedAt: new Date(), timeZone: 'UTC' }], [], 1), []);
});

test('an earned secret trophy can become the cinema-card crown without any locked metadata', () => {
  const awards = visibleHiddenTrophies([{ achievementId: 'steady_week', unlockedAt: new Date(), timeZone: 'UTC' }], [{ achievementId: 'steady_week', count: 1 }], 100);
  const crown = selectCinemaCrown({ watch: 30 }, { watch: [getOwnershipStats(90, 100), getOwnershipStats(70, 100), getOwnershipStats(30, 100)] }, awards);
  assert.equal(crown?.id, 'steady_week');
  assert.equal(crown?.hidden, true);
});
