import test from 'node:test';
import assert from 'node:assert/strict';
import { localRoomPath, roomReference } from '../src/lib/local-cinema-room';
const origin = 'https://example.test';
test('Local room accepts route-compatible codes without inventing movie IDs', () => {
  for (const code of ['ABCD', 'abc_DEF-12', 'A'.repeat(64)])
    assert.deepEqual(roomReference(' ' + code + ' ', origin), {
      code,
      movieId: null,
    });
  for (const code of ['', 'A', 'ABC', 'A'.repeat(65), 'КИНО', 'A B C'])
    assert.equal(roomReference(code, origin), null);
});
test('Local room reference retains the explicit selected movie', () => {
  assert.deepEqual(roomReference('/room/ABC123?movie=42', origin), {
    code: 'ABC123',
    movieId: 42,
  });
  assert.deepEqual(roomReference(origin + '/room/abc123?movie=7', origin), {
    code: 'abc123',
    movieId: 7,
  });
  assert.equal(localRoomPath('abc123', 7), '/room/abc123?movie=7');
  assert.equal(localRoomPath('abc123'), '/room/abc123');
});
test('Local room rejects external URLs, credentials and non-room paths', () => {
  for (const value of [
    'https://other.test/room/ABCD?movie=1',
    '//other.test/room/ABCD',
    'https://user:pass@example.test/room/ABCD',
    'javascript:alert(1)',
    'data:text/html,hi',
    '/movie/42',
    '/room/ABCD/extra',
  ])
    assert.equal(roomReference(value, origin), null, value);
});
test('Invalid/missing movie references do not fall back to movie one', () => {
  for (const value of ['', '0', '-1', '1.5', 'NaN', 'Infinity', '2147483648'])
    assert.equal(
      roomReference('/room/ABCD?movie=' + value, origin)?.movieId,
      null,
    );
});
