import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatOwnershipPercentage, getOwnershipStats } from '../src/lib/ownership';
import { calculateAchievementProgress, type AchievementActivity } from '../src/lib/achievement-progress';
import { achievementDefs } from '../src/lib/achievements';
import { buildCommunityCollectibles } from '../src/lib/community-collectibles';

for (const [owners, rarity] of [[0, 'legendary'], [2, 'legendary'], [3, 'epic'], [9, 'epic'], [10, 'rare'], [19, 'rare'], [20, 'uncommon'], [49, 'uncommon'], [50, 'common'], [100, 'common']] as const) {
  test(`ownership ${owners}% is ${rarity}`, () => {
    const stats = getOwnershipStats(owners, 100);
    assert.equal(stats.percentage, owners);
    assert.equal(stats.rarity, rarity);
  });
}

test('empty community is unavailable, not a fake legendary 0%', () => {
  assert.deepEqual(getOwnershipStats(0, 0), { earnedUsers: 0, totalUsers: 0, percentage: null, rarity: null });
  assert.equal(formatOwnershipPercentage(null), '—');
  assert.equal(formatOwnershipPercentage(0), '0%');
  assert.equal(formatOwnershipPercentage(0.001), '<0,1%');
  assert.equal(formatOwnershipPercentage(33.3333), '33,3%');
  assert.equal(formatOwnershipPercentage(100), '100%');
});

test('rarity uses unrounded percentage and counts are bounded', () => {
  assert.equal(getOwnershipStats(2999, 100000).rarity, 'legendary');
  assert.equal(getOwnershipStats(99, 1).percentage, 100);
  assert.equal(getOwnershipStats(-1, 3).percentage, 0);
});

const emptyActivity: AchievementActivity = {
  xp: 0, watches: [], ratings: [], comments: [], scores: [], friendCount: 0,
  bookmarkCount: 0, recommendationCount: 0, messageCount: 0, completedChallenges: 0,
};

test('one evaluator covers all 31 achievement ids with tier-compatible numeric progress', () => {
  const progress = calculateAchievementProgress(emptyActivity, new Map());
  assert.equal(achievementDefs.length, 31);
  assert.deepEqual(Object.keys(progress).sort(), achievementDefs.map(def => def.id).sort());
  assert.equal(progress.level10, 1);
  for (const def of achievementDefs) {
    assert.equal(Number.isFinite(progress[def.id]), true);
    assert.equal(progress[def.id] >= def.targets[0], false);
  }
});

test('calendar progress uses UTC, unique dates and days with three watches', () => {
  const progress = calculateAchievementProgress({ ...emptyActivity, watches: [
    { movieId: 1, watchedAt: '2026-11-21T23:30:00Z' },
    { movieId: 1, watchedAt: '2026-11-22T02:30:00+03:00' },
    { movieId: 1, watchedAt: '2026-11-21T21:00:00Z' },
    { movieId: 2, watchedAt: '2026-11-23T00:30:00Z' },
  ] }, new Map([
    [1, { id: 1, duration: 60, category: 'Аниме', genre: 'Экшен, драма' }],
    [2, { id: 2, duration: 120, category: 'Сериал', genre: 'Фантастика, триллер' }],
  ]));
  assert.equal(progress.watch, 4);
  assert.equal(progress.binge, 2);
  assert.equal(progress.night, 3);
  assert.equal(progress.speed, 1);
  assert.equal(progress.weekend, 3);
  assert.equal(progress.hours, 5);
  assert.equal(progress.explorer, 2);
  assert.equal(progress.genre_all, 2);
  assert.equal(progress.action, 3);
  assert.equal(progress.anime, 3);
  assert.equal(progress.series, 1);
  assert.equal(progress.scifi, 1);
});

test('recommendations, chat and games use their real activities', () => {
  const progress = calculateAchievementProgress({ ...emptyActivity,
    recommendationCount: 5, messageCount: 25,
    scores: [{ game: 'chat', score: 100 }, { game: 'quiz', score: 5 }],
    comments: [{ likes: null }, { likes: 4 }],
    ratings: [{ value: 10 }, { value: 4 }], xp: 4500,
  }, new Map());
  assert.equal(progress.ambassador, 5);
  assert.equal(progress.chatty, 25);
  assert.equal(progress.player, 1);
  assert.equal(progress.champion, 1);
  assert.equal(progress.allgames, 1);
  assert.equal(progress.popular_comment, 4);
  assert.equal(progress.perfectionist, 1);
  assert.equal(progress.harsh, 1);
  assert.equal(progress.level10, 10);
});

function community() {
  return buildCommunityCollectibles({
    people: [{ id: 1, xp: 500 }, { id: 2, xp: null }, { id: 3, xp: 0 }, { id: 4, xp: 0 }],
    films: [{ id: 1, duration: 90, category: 'Фильм', genre: 'Драма' }],
    watches: Array.from({ length: 10 }, () => ({ userId: 1, movieId: 1, watchedAt: '2026-11-22T21:00:00Z' })),
    ratings: [{ userId: 2, value: 10 }], comments: [], scores: [],
    bookmarkCounts: [{ userId: 1, count: 12 }],
    recommendationCounts: [{ userId: 2, count: 5 }], messageCounts: [{ userId: 3, count: 25 }],
    acceptedFriendships: [{ fromId: 1, toId: 2 }, { fromId: 2, toId: 1 }, { fromId: 1, toId: 999 }],
    challengeProgress: [
      { userId: 1, challengeId: 7, year: 2026, completed: true, rewardClaimed: true },
      { userId: 1, challengeId: 7, year: 2026, completed: true, rewardClaimed: true },
      { userId: 2, challengeId: 7, year: 2026, completed: false, rewardClaimed: true },
      { userId: 3, challengeId: 7, year: 2025, completed: true, rewardClaimed: true },
      { userId: 4, challengeId: 7, year: 2026, completed: false, rewardClaimed: false },
      { userId: 999, challengeId: 7, year: 2026, completed: true, rewardClaimed: true },
    ],
    challengeIds: [7, 8], year: 2026,
  });
}

test('uses every registered user, including inactive users, and counts each tier separately', () => {
  const result = community();
  assert.equal(result.totalUsers, 4);
  assert.deepEqual(result.achievementStats.watch.map(stat => stat.percentage), [25, 25, 0]);
  assert.deepEqual(result.achievementStats.hundred.map(stat => stat.earnedUsers), [0, 0, 0]);
  assert.equal(result.achievementStats.ratings[0].percentage, 25);
  assert.equal(result.progressByUser.get(1)?.social, 1);
  assert.equal(result.progressByUser.get(2)?.social, 1);
  assert.equal(result.progressByUser.get(2)?.ambassador, 5);
  assert.equal(result.progressByUser.get(3)?.chatty, 25);
});

test('challenge owners are unique current-year registered users; claimed rewards preserve completion', () => {
  const result = community();
  assert.equal(result.challengeStats[7].earnedUsers, 2);
  assert.equal(result.challengeStats[7].percentage, 50);
  assert.equal(result.challengeStats[8].percentage, 0);
  assert.equal(result.achievementStats.challenges_done[0].percentage, 50);
  assert.equal(result.progressByUser.get(1)?.challenges_done, 1);
  assert.equal(result.progressByUser.get(3)?.challenges_done, 0);
});
