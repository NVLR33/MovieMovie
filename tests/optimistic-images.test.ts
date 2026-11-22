import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCollectionUpdate, type CollectionUpdate } from '../src/lib/optimistic-collections';
import { imageUrl, validImageBytes, MAX_IMAGE_BYTES } from '../src/lib/image-storage';
const empty = { bookmarks: [] as { movieId: number }[], favorites: [] as { movieId: number }[], favoriteIds: [] as number[], watches: [] as { id: number; movieId: number; watchedAt: string }[], ratings: [] as { id: number; movieId: number; value: number }[], xp: 123 };
const update = (kind: CollectionUpdate['kind'], enabled = true): CollectionUpdate => ({ movieId: 7, kind, enabled, watchedAt: '2026-11-22T12:00:00Z', value: 8 });
test('optimistic collections are immutable and idempotent when rebased on confirmed state', () => {
  for (const kind of ['watch','rate','bookmark','favorite'] as const) {
    const next = applyCollectionUpdate(empty, update(kind));
    assert.deepEqual(applyCollectionUpdate(next, update(kind)), next);
    assert.equal(next.xp, 123); assert.equal(empty.bookmarks.length,0); assert.equal(empty.watches.length,0);
  }
});
test('overlapping optimistic updates preserve unrelated collections and can remove entries', () => {
  const state = applyCollectionUpdate(applyCollectionUpdate(empty, update('favorite')), update('watch'));
  assert.deepEqual(state.favoriteIds, [7]); assert.equal(state.watches.length,1);
  const next = applyCollectionUpdate(state, update('watch',false));
  assert.equal(next.watches.length,0); assert.deepEqual(next.favoriteIds,[7]);
  assert.equal(applyCollectionUpdate(state,update('watch')).watches[0].watchedAt, '2026-11-22T12:00:00Z');
});
test('image columns accept only bounded HTTP(S) or local paths, never inline data', () => {
  assert.equal(imageUrl('https://images.test/a.png'),'https://images.test/a.png');
  assert.equal(imageUrl('/brand/logo.png'),'/brand/logo.png'); assert.equal(imageUrl(''),'');
  for (const bad of ['data:image/png;base64,abcd','blob:https://example/a','javascript:alert(1)','//example/a','https://user:pass@example/a','/\\evil/a','https://x.test/\nimage','https://x.test/'+ 'a'.repeat(4096)]) assert.throws(()=>imageUrl(bad,true));
  assert.throws(()=>imageUrl('',true));
});
test('upload checks magic bytes and hard limits, not only claimed MIME type', () => {
  const png = new Uint8Array([137,80,78,71,13,10,26,10]);
  assert(validImageBytes(png,'image/png')); assert(!validImageBytes(png,'image/jpeg'));
  assert(validImageBytes(new Uint8Array([255,216,255,224]),'image/jpeg'));
  assert(validImageBytes(new TextEncoder().encode('RIFF1234WEBP'),'image/webp'));
  assert(!validImageBytes(new TextEncoder().encode('<svg>'),'image/png'));
  assert(!validImageBytes(new Uint8Array(MAX_IMAGE_BYTES+1),'image/png'));
  assert(!validImageBytes(new Uint8Array(),'image/png'));
});
