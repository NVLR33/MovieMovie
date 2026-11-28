export type CommunityPerson = {
  id: number;
  username: string;
  avatar: string | null;
  role: string;
  xp: number | null;
};
export type CommunityRelation = {
  id: number;
  fromId: number;
  toId: number;
  status: string;
};
export type CommunityScope = 'all' | 'friends' | 'incoming' | 'outgoing';

/** Never interpret another pair's friendship as the viewer's relationship. */
export function communityRelation(
  relations: readonly CommunityRelation[],
  viewerId: number,
  peerId: number,
) {
  return relations.find(
    (r) =>
      (r.fromId === viewerId && r.toId === peerId) ||
      (r.toId === viewerId && r.fromId === peerId),
  );
}
export function communityState(
  relation: CommunityRelation | undefined,
  viewerId: number,
): CommunityScope | 'none' {
  if (relation?.status === 'accepted') return 'friends';
  if (relation?.status === 'pending')
    return relation.toId === viewerId ? 'incoming' : 'outgoing';
  return 'none';
}
export function selectCommunityPeople<T extends CommunityPerson>(
  people: readonly T[],
  relations: readonly CommunityRelation[],
  viewerId: number,
  query: string,
  scope: CommunityScope,
): T[] {
  const needle = query.trim().toLocaleLowerCase();
  return [
    ...new Map(people.map((person) => [person.id, person])).values(),
  ].filter(
    (person) =>
      person.id !== viewerId &&
      (!needle || person.username.toLocaleLowerCase().includes(needle)) &&
      (scope === 'all' ||
        communityState(
          communityRelation(relations, viewerId, person.id),
          viewerId,
        ) === scope),
  );
}
