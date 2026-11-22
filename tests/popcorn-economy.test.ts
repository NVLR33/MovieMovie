import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POPCORN_MILESTONES, POPCORN_WEEKLY, popcornAccrual, popcornEntryLabel, popcornRequirementsMet, popcornWeek } from '../src/lib/popcorn-economy';

test('cinema weeks start Monday at midnight UTC, including year boundaries', () => {
  for (const input of ['2026-11-22T23:59:59Z', '2026-11-16T00:00:00Z']) {
    const week = popcornWeek(new Date(input));
    assert.equal(week.key, '2026-11-16');
    assert.equal(week.end.toISOString(), '2026-11-23T00:00:00.000Z');
  }
  assert.equal(popcornWeek(new Date('2026-11-23T00:00:00Z')).key, '2026-11-23');
  assert.equal(popcornWeek(new Date('2027-01-01T12:00:00Z')).key, '2026-12-28');
  assert.equal(popcornWeek(new Date('2026-11-23T04:59:59+05:00')).key, '2026-11-16');
});
test('weekly rewards are bounded, deterministic and require all parts of a session', () => {
  assert.equal(POPCORN_WEEKLY.reduce((sum, q) => sum + q.popcorn, 0), 80);
  assert.equal(new Set(POPCORN_WEEKLY.map(q => q.id)).size, POPCORN_WEEKLY.length);
  const session = POPCORN_WEEKLY.find(q => q.id === 'session')!;
  assert.equal(popcornRequirementsMet({ watch: 3, rate: 3, review: 0, catalog: 100 }, session.requirements), false);
  assert.equal(popcornRequirementsMet({ watch: 3, rate: 3, review: 1, catalog: 0 }, session.requirements), true);
  assert(POPCORN_WEEKLY.every(q => q.popcorn > 0 && Object.values(q.requirements).every(n => n > 0)));
});
test('milestones have unique immutable keys and finite one-time payouts', () => {
  assert.equal(new Set(POPCORN_MILESTONES.map(m => m.id)).size, POPCORN_MILESTONES.length);
  assert.equal(POPCORN_MILESTONES.reduce((sum, m) => sum + m.popcorn, 0), 440);
  assert(POPCORN_MILESTONES.every(m => m.popcorn > 0 && m.target > 0));
});
test('fractional projector output survives frequent collection without rounding up', () => {
  const start = new Date('2026-11-22T12:00:00Z');
  const first = popcornAccrual(start, 0, new Date(start.getTime() + 45 * 60000));
  assert.equal(first.pending, 1); assert.equal(first.carry, 1800000);
  const second = popcornAccrual(new Date(start.getTime() + 45 * 60000), 0, new Date(start.getTime() + 60 * 60000), first.carry);
  assert.equal(second.pending, 1); assert.equal(second.carry, 0);
});
test('collecting on arbitrary intervals conserves output at all projector levels', () => {
  for (let level = 0; level <= 5; level++) {
    let carry = 0, earned = 0, last = new Date(0);
    for (let i = 1; i <= 250; i++) {
      const now = new Date(i * 137137);
      const accrual = popcornAccrual(last, level, now, carry);
      earned += accrual.pending; carry = accrual.carry; last = now;
    }
    const whole = popcornAccrual(new Date(0), level, last);
    assert.equal(earned, whole.pending); assert.equal(carry, whole.carry);
  }
});
test('changing projector speed retains old-rate fraction, not retroactive boosted output', () => {
  const first = popcornAccrual(new Date(0), 0, new Date(15 * 60000));
  assert.equal(first.pending, 0);
  const after = popcornAccrual(new Date(15 * 60000), 1, new Date(25 * 60000), first.carry);
  assert.equal(after.pending, 1); assert.equal(after.carry, 0);
});
test('capacity discards overflow and fractions at cap; invalid values never print currency', () => {
  const full = popcornAccrual(new Date(0), 5, new Date(100 * 3600000), 3599999);
  assert.equal(full.pending, 168); assert.equal(full.carry, 0);
  assert.equal(popcornAccrual(null, 5, new Date(), 3599999).pending, 0);
  assert.equal(popcornAccrual('invalid', 5).pending, 0);
  assert.equal(popcornAccrual(new Date(0), NaN, new Date(3600000), NaN).pending, 2);
  assert.equal(popcornAccrual(new Date(0), 0, new Date(0), -500).carry, 0);
});
test('history explains caps and names bonus sources without exposing raw keys', () => {
  assert.match(popcornEntryLabel('watch', 'watch:1', 0), /дневной лимит/);
  assert.equal(popcornEntryLabel('watch', 'watch:1', 10), 'Первый просмотр');
  assert.equal(popcornEntryLabel('weekly', 'weekly:session:2026-11-16', 25), 'Неделя: Полный киносеанс');
  assert.equal(popcornEntryLabel('milestone', 'milestone:watch10', 25), 'Рубеж: Десять новых историй');
});
