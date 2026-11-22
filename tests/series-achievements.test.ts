import assert from 'node:assert/strict';
import { test } from 'node:test';
import { achievementDefs, ACHIEVEMENT_TIERS } from '../src/lib/achievements';
import { calculateAchievementProgress, type AchievementActivity } from '../src/lib/achievement-progress';
import { seriesProgress, isSeries, validSeriesRating, type SeriesSeason } from '../src/lib/series';
import { buildCommunityCollectibles } from '../src/lib/community-collectibles';
import { selectCinemaCrown } from '../src/lib/cinema-card';
import { getOwnershipStats } from '../src/lib/ownership';

const activity: AchievementActivity = { xp: 0, watches: [], ratings: [], comments: [], scores: [], friendCount: 0, bookmarkCount: 0, recommendationCount: 0, messageCount: 0, completedChallenges: 0 };

test('every ordinary achievement has four strictly increasing named levels', () => {
  assert.deepEqual(ACHIEVEMENT_TIERS, ['Бронза', 'Серебро', 'Золото', 'Платина']);
  for (const def of achievementDefs) {
    assert.equal(def.targets.length, 4, def.id);
    assert(def.targets.every((target, i) => target > 0 && (!i || target > def.targets[i - 1])), def.id);
  }
  assert.deepEqual(achievementDefs.find(d => d.id === 'archaeologist')!.targets, [1, 5, 20, 50]);
});

test('archaeologist counts unique films, not re-watches, series, unknown years or 1960 releases', () => {
  const films = new Map([
    [1, { id: 1, year: 1959, category: 'Фильм', genre: '', duration: 90 }],
    [2, { id: 2, year: 1960, category: 'Фильм', genre: '', duration: 90 }],
    [3, { id: 3, year: 1950, category: 'Сериал', genre: '', duration: 40 }],
    [4, { id: 4, year: 0, category: 'Фильм', genre: '', duration: 90 }],
    [5, { id: 5, year: 1940, category: 'Фильм', genre: '', duration: 90 }],
  ]);
  const progress = calculateAchievementProgress({ ...activity, completedSeries: 3, watches: [1, 1, 2, 3, 4, 5, 999].map(movieId => ({ movieId, watchedAt: new Date() })) }, films);
  assert.equal(progress.archaeologist, 2);
  assert.equal(progress.serial_completion, 3);
});

function seasons(count = 10): SeriesSeason[] {
  return [{ id: 1, number: 1, title: '', rating: 8, episodes: Array.from({ length: count }, (_, i) => ({ id: i + 1, number: i + 1, title: '', rating: 8 })) }];
}

test('serial completion requires an editor-confirmed full catalog of at least ten episodes and every season rating', () => {
  assert.equal(seriesProgress(seasons(), true).complete, true);
  assert.equal(seriesProgress(seasons(9), true).complete, false);
  assert.equal(seriesProgress(seasons(), false).complete, false);
  assert.equal(seriesProgress([], true).complete, false);
  assert.equal(seriesProgress([{ ...seasons()[0], rating: null }], true).complete, false);
  const incomplete = seasons(); incomplete[0].episodes[9].rating = null;
  assert.equal(seriesProgress(incomplete, true).rated, 10);
  assert.equal(seriesProgress(incomplete, true).complete, false);
  assert.equal(seriesProgress([...seasons(), { id: 2, number: 2, title: '', rating: 10, episodes: [] }], true).complete, false);
});

test('season and episode ratings enforce the same half-step range as title ratings', () => {
  for (const invalid of [0, 10.5, 8.2, NaN, Infinity, '8', null]) assert.equal(validSeriesRating(invalid), false);
  for (const valid of [0.5, 8, 9.5, 10]) assert.equal(validSeriesRating(valid), true);
  assert.equal(isSeries('Сериал'), true);
  assert.equal(isSeries('Аниме-сериал'), true);
  assert.equal(isSeries('Фильм'), false);
});

test('platinum rarity and permanent series completion counts reach the shared evaluator', () => {
  const community = buildCommunityCollectibles({ people: [{ id: 1, xp: 0 }, { id: 2, xp: 0 }], films: [], watches: [], ratings: [], comments: [], scores: [], bookmarkCounts: [], recommendationCounts: [], messageCounts: [], acceptedFriendships: [], challengeProgress: [], challengeIds: [], year: 2026, seriesCompletionCounts: [{ userId: 1, count: 10 }] });
  assert.deepEqual(community.achievementStats.serial_completion.map(s => s.earnedUsers), [1, 1, 1, 1]);
  const crown = selectCinemaCrown(community.progressByUser.get(1)!, community.achievementStats);
  assert.equal(crown?.id, 'serial_completion');
  assert.equal(crown?.tier, 4);
  assert.equal(crown?.stats.percentage, 50);
  assert.equal(getOwnershipStats(1, 2).percentage, 50);
});
