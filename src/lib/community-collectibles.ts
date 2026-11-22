import { achievementDefs, type AchievementId, type AchievementProgress } from './achievements';
import { calculateAchievementProgress, type AchievementFilm, type AchievementWatch } from './achievement-progress';
import { getOwnershipStats, type OwnershipStats } from './ownership';

type CountByUser = { userId: number | null; count: number };
type ProgressRow = { userId: number; challengeId: number; year: number; completed: boolean | null; rewardClaimed: boolean };

function groupByUser<T extends { userId: number }>(rows: readonly T[]) {
  const result = new Map<number, T[]>();
  for (const row of rows) {
    const group = result.get(row.userId);
    if (group) group.push(row);
    else result.set(row.userId, [row]);
  }
  return result;
}

/** Only aggregated ownership and the caller's own progress should leave the server. */
export function buildCommunityCollectibles(input: {
  people: readonly { id: number; xp: number | null }[];
  films: readonly AchievementFilm[];
  watches: readonly (AchievementWatch & { userId: number })[];
  ratings: readonly { userId: number; value: number }[];
  comments: readonly { userId: number; likes: number | null }[];
  scores: readonly { userId: number; game: string; score: number }[];
  bookmarkCounts: readonly CountByUser[];
  recommendationCounts: readonly CountByUser[];
  messageCounts: readonly CountByUser[];
  acceptedFriendships: readonly { fromId: number; toId: number }[];
  challengeProgress: readonly ProgressRow[];
  challengeIds: readonly number[];
  year: number;
}) {
  const films = new Map(input.films.map(film => [film.id, film]));
  const watches = groupByUser(input.watches);
  const ratings = groupByUser(input.ratings);
  const comments = groupByUser(input.comments);
  const scores = groupByUser(input.scores);
  const counts = (rows: readonly CountByUser[]) => new Map(rows.map(row => [row.userId, row.count]));
  const bookmarks = counts(input.bookmarkCounts);
  const recommendations = counts(input.recommendationCounts);
  const messages = counts(input.messageCounts);
  const knownUsers = new Set(input.people.map(person => person.id));
  const friends = new Map<number, Set<number>>();
  for (const { fromId, toId } of input.acceptedFriendships) {
    if (fromId === toId || !knownUsers.has(fromId) || !knownUsers.has(toId)) continue;
    if (!friends.has(fromId)) friends.set(fromId, new Set());
    if (!friends.has(toId)) friends.set(toId, new Set());
    friends.get(fromId)!.add(toId);
    friends.get(toId)!.add(fromId);
  }
  const challengeOwners = new Map<number, Set<number>>();
  const completedByUser = new Map<number, Set<number>>();
  const knownChallenges = new Set(input.challengeIds);
  for (const row of input.challengeProgress) {
    if (row.year !== input.year || (!row.completed && !row.rewardClaimed) ||
        !knownUsers.has(row.userId) || !knownChallenges.has(row.challengeId)) continue;
    if (!challengeOwners.has(row.challengeId)) challengeOwners.set(row.challengeId, new Set());
    if (!completedByUser.has(row.userId)) completedByUser.set(row.userId, new Set());
    challengeOwners.get(row.challengeId)!.add(row.userId);
    completedByUser.get(row.userId)!.add(row.challengeId);
  }
  const progressByUser = new Map<number, AchievementProgress>();
  const ownerCounts = Object.fromEntries(achievementDefs.map(def => [def.id, [0, 0, 0]])) as Record<AchievementId, number[]>;
  for (const person of input.people) {
    const progress = calculateAchievementProgress({
      xp: person.xp || 0,
      watches: watches.get(person.id) || [],
      ratings: ratings.get(person.id) || [],
      comments: comments.get(person.id) || [],
      scores: scores.get(person.id) || [],
      friendCount: friends.get(person.id)?.size || 0,
      bookmarkCount: bookmarks.get(person.id) || 0,
      recommendationCount: recommendations.get(person.id) || 0,
      messageCount: messages.get(person.id) || 0,
      completedChallenges: completedByUser.get(person.id)?.size || 0,
    }, films);
    progressByUser.set(person.id, progress);
    for (const def of achievementDefs) {
      def.targets.forEach((target, tier) => {
        if (progress[def.id] >= target) ownerCounts[def.id][tier]++;
      });
    }
  }
  const totalUsers = knownUsers.size;
  const achievementStats = Object.fromEntries(achievementDefs.map(def => [
    def.id, ownerCounts[def.id].map(count => getOwnershipStats(count, totalUsers)),
  ])) as Record<AchievementId, OwnershipStats[]>;
  const challengeStats = Object.fromEntries(input.challengeIds.map(id => [
    id, getOwnershipStats(challengeOwners.get(id)?.size || 0, totalUsers),
  ])) as Record<number, OwnershipStats>;
  return { totalUsers, year: input.year, achievementStats, challengeStats, progressByUser };
}
