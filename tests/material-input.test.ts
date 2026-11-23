import assert from 'node:assert/strict';
import { test } from 'node:test';
import { materialIdentity, parseMaterialInput } from '../src/lib/material-input';
import { filterSuggestions, matchingSuggestionMovie, type MovieSuggestion } from '../src/lib/movie-suggestions';
const valid = { title: ' История ', description: 'Описание', category: 'Фильм', genre: 'Драма', year: 2020, duration: 90, poster: 'https://images.test/poster.jpg' };
test('full material contract allowlists content, normalizes series fields and ignores privileged attributes', () => {
  const material = parseMaterialInput({ ...valid, id: 1, featured: true, views: 900, status: 'approved', userId: 2, movieId: 3, episodes: 0, endYear: 1990, ongoing: true });
  assert.equal(material.title, 'История'); assert.equal(material.episodes, null); assert.equal(material.endYear, null); assert.equal(material.ongoing, false);
  for (const key of ['id','featured','views','status','userId','movieId']) assert(!Object.hasOwn(material,key));
  assert.equal(materialIdentity(material), materialIdentity({ ...material, title: ' история ' }));
  assert.deepEqual(parseMaterialInput({ ...valid, category: 'Аниме-сериал', episodes: 12, ongoing: true, endYear: 2025, mood: 'cry' }), { ...material, category: 'Аниме-сериал', episodes: 12, ongoing: true, mood: 'tears' });
});
test('same validation rejects incomplete, oversized, unsafe and inconsistent proposed/published cards', () => {
  for (const patch of [{ title: 'x' }, { description: '' }, { description: 'a'.repeat(3001) }, { year: 1800 }, { year: true }, { category: 'invalid' }, { poster: 'data:image/png;base64,hi' }, { watchUrl: 'javascript:alert(1)' }, { watchUrl: 'https://user:pass@test.local' }, { duration: 0 }, { mood: 'unknown' }, { category: 'Сериал', endYear: 2019 }, { category: 'Сериал', episodes: -1 }, { genre: [] }]) assert.throws(() => parseMaterialInput({ ...valid, ...patch }), JSON.stringify(patch));
});
const proposal = (id: number, status: MovieSuggestion['status'], category = 'Фильм'): MovieSuggestion => ({ id, status, category, userId: 1, title: `История ${id}`, year: 2020, genre: 'Драма', material: null, comment: null, createdAt: '2026-11-22', reviewedAt: null, reviewReason: null, movieId: null, author: { id: 1, username: 'Киноман', avatar: null, role: 'visitor' } });
test('moderation queue intersects statuses/categories/search, orders deterministically and never mutates data', () => {
  const source = [proposal(1,'pending'), proposal(2,'approved'), proposal(3,'pending','Сериал'), proposal(4,'rejected')];
  const before = structuredClone(source);
  const options = { status: 'pending', category: 'Все', search: '', sort: 'oldest' };
  assert.deepEqual(filterSuggestions(source,options).map(s=>s.id),[1,3]);
  assert.deepEqual(filterSuggestions(source,{...options,category:'Сериал',search:' КИНОМАН '}).map(s=>s.id),[3]);
  assert.deepEqual(filterSuggestions(source,{...options,status:'approved'}).map(s=>s.id),[2]);
  assert.deepEqual(filterSuggestions(source,{...options,sort:'newest',search:'2020'}).map(s=>s.id),[3,1]);
  assert.deepEqual(source,before);
  assert.equal(matchingSuggestionMovie(source[0],[{id:99,title:' история 1 ',year:2020,category:'Фильм'}])?.id,99);
  assert.equal(matchingSuggestionMovie(source[0],[{id:99,title:'История 1',year:2020,category:'Сериал'}]),undefined);
});
