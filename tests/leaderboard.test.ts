import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LEADERBOARD_LIMITS,
  LEADERBOARD_METRICS,
  getTopLeaders,
  getLeaderboardPodium,
  type LeaderboardMetric,
} from '../src/lib/leaderboard';

function person(id: number) {
  return { id, minutes: id * 60, watches: id, streak: id, xp: id as number | null, ratings: id, gameScore: id };
}
const community = Array.from({ length: 150 }, (_, index) => person(index + 1));

test('offers exactly the requested seven top sizes', () => {
  assert.deepEqual(LEADERBOARD_LIMITS, [1, 3, 5, 10, 25, 50, 100]);
});

for (const limit of LEADERBOARD_LIMITS) {
  test(`top-${limit} sorts all participants before limiting the result`, () => {
    const result = getTopLeaders(community, 'minutes', limit);
    assert.equal(result.length, limit);
    assert.equal(result[0].id, 150);
    assert.equal(result[limit - 1].id, 151 - limit);
  });
}

for (const metric of Object.keys(LEADERBOARD_METRICS) as LeaderboardMetric[]) {
  test(`${metric} uses the selected score, not the default minutes order`, () => {
    const leaders = [person(1), { ...person(2), [metric]: 10000 }, person(3)];
    assert.equal(getTopLeaders(leaders, metric, 1)[0].id, 2);
  });
}

test('ties have a deterministic order and a null XP score counts as zero', () => {
  const leaders = [person(3), { ...person(2), xp: null }, { ...person(1), xp: 3 }];
  assert.deepEqual(getTopLeaders(leaders, 'xp', 100).map(p => p.id), [1, 3, 2]);
});

test('switching metric or limit does not mutate the shared application data', () => {
  const before = structuredClone(community);
  getTopLeaders(community, 'minutes', 100);
  getTopLeaders(community, 'xp', 1);
  assert.deepEqual(community, before);
});

test('small communities show only real participants, without placeholders', () => {
  assert.equal(getTopLeaders(community.slice(0, 4), 'minutes', 100).length, 4);
  assert.deepEqual(getTopLeaders([], 'minutes', 100), []);
  assert.deepEqual(getLeaderboardPodium([]), []);
});

test('top-1 podium contains only the winner with the first-place crown', () => {
  const leaders = getTopLeaders(community, 'minutes', 1);
  assert.deepEqual(getLeaderboardPodium(leaders), [{ person: leaders[0], place: 1 }]);
});

test('two-person podium preserves actual ranks and does not invent a bronze winner', () => {
  const leaders = [person(3), person(2)];
  assert.deepEqual(getLeaderboardPodium(leaders), [
    { person: leaders[1], place: 2 },
    { person: leaders[0], place: 1 },
  ]);
});

test('larger tops keep exactly the first three people on the podium in silver/gold/bronze order', () => {
  const leaders = getTopLeaders(community, 'minutes', 100);
  assert.deepEqual(getLeaderboardPodium(leaders).map(p => [p.person.id, p.place]), [[149, 2], [150, 1], [148, 3]]);
});
