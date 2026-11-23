import test from 'node:test';
import assert from 'node:assert/strict';
import { experienceProgress, nextAchievement } from '../src/lib/hud-progress';
import { achievementDefs } from '../src/lib/achievements';

test('HUD experience shares the server 500 XP level boundaries', () => {
  assert.deepEqual(experienceProgress(499), {
    total: 499,
    level: 1,
    current: 499,
    remaining: 1,
    percent: 99.8,
  });
  assert.deepEqual(experienceProgress(500), {
    total: 500,
    level: 2,
    current: 0,
    remaining: 500,
    percent: 0,
  });
  assert.equal(experienceProgress(1535).level, 4);
  assert.equal(experienceProgress(1535).current, 35);
  assert.equal(experienceProgress(1500).remaining, 500);
});
test('HUD handles missing, invalid, negative, fractional and decreasing XP', () => {
  for (const value of [null, undefined, NaN, Infinity, -25])
    assert.equal(experienceProgress(value).total, 0);
  assert.equal(experienceProgress(501.9).total, 501);
  assert.equal(experienceProgress(465).level, 1);
  assert.equal(experienceProgress(465).current, 465);
});
test('mission chooses the closest actual next achievement tier, stably', () => {
  const goal = nextAchievement({ watch: 9, explorer: 1 });
  assert.equal(goal?.id, 'watch');
  assert.equal(goal?.tier, 'Серебро');
  assert.equal(goal?.target, 10);
  assert.equal(goal?.current, 9);
  assert.equal(goal?.percent, 90);
  assert.equal(nextAchievement({})?.id, achievementDefs[0].id);
});
test('maxed achievements disappear from next goal, all maxed yields no fake goal', () => {
  const all = Object.fromEntries(
    achievementDefs.map((def) => [def.id, def.targets.at(-1)!]),
  );
  assert.equal(nextAchievement(all), null);
  assert.notEqual(nextAchievement({ watch: 100 })?.id, 'watch');
  assert.equal(nextAchievement({ watch: NaN })?.current, 0);
  assert.equal(nextAchievement({ watch: -1 })?.current, 0);
});
