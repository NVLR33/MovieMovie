import test from 'node:test';
import assert from 'node:assert/strict';
import {
  communityRelation,
  communityState,
  selectCommunityPeople,
  type CommunityPerson,
} from '../src/lib/community-directory';
const people: CommunityPerson[] = Array.from({ length: 5 }, (_, id) => ({
  id: id + 1,
  username: ['Я', 'Алиса', 'Борис', 'Анна', 'Лев'][id],
  avatar: null,
  role: 'visitor',
  xp: 0,
}));
const relations = [
  { id: 1, fromId: 2, toId: 1, status: 'accepted' },
  { id: 2, fromId: 3, toId: 1, status: 'pending' },
  { id: 3, fromId: 1, toId: 4, status: 'pending' },
  { id: 4, fromId: 5, toId: 99, status: 'accepted' },
];
const ids = (scope: 'all' | 'friends' | 'incoming' | 'outgoing', query = '') =>
  selectCommunityPeople(people, relations, 1, query, scope).map((p) => p.id);
test('Community directory excludes the viewer, preserves order and deduplicates IDs', () => {
  assert.deepEqual(ids('all'), [2, 3, 4, 5]);
  assert.equal(
    selectCommunityPeople([...people, people[2]], relations, 1, '', 'all')
      .length,
    4,
  );
});
test('Community scopes distinguish both directions and accepted friends', () => {
  assert.deepEqual(ids('friends'), [2]);
  assert.deepEqual(ids('incoming'), [3]);
  assert.deepEqual(ids('outgoing'), [4]);
  assert.equal(communityState(communityRelation(relations, 1, 5), 1), 'none');
});
test('A third party relationship never becomes the viewer relationship', () => {
  assert.equal(communityRelation(relations, 1, 5), undefined);
  assert.equal(communityState(undefined, 1), 'none');
});
test('Community search intersects scope and trims case-insensitively', () => {
  assert.deepEqual(ids('all', ' А '), [2, 4]);
  assert.deepEqual(ids('friends', 'анна'), []);
  assert.deepEqual(ids('outgoing', ' АННА '), [4]);
  assert.deepEqual(ids('all', 'несуществующий'), []);
});
test('Community selection never mutates source data or manufactures peers', () => {
  const before = JSON.stringify({ people, relations });
  ids('all');
  ids('incoming');
  assert.equal(JSON.stringify({ people, relations }), before);
  assert.deepEqual(selectCommunityPeople([], relations, 1, '', 'all'), []);
});
