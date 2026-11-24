import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  trailerSource,
  trailerUrl,
  trailerPreviewUrl,
  materialTone,
  validTrailerHeader,
  MAX_TRAILER_BYTES,
} from '../src/lib/trailers';
import { parseMaterialInput } from '../src/lib/material-input';
test('trailer references normalize known providers, never reuse the watch URL', () => {
  const youtube = trailerSource('https://youtu.be/dQw4w9WgXcQ')!;
  assert.deepEqual(youtube, {
    kind: 'embed',
    url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    hover: true,
  });
  assert.equal(
    new URL(trailerPreviewUrl(youtube)).searchParams.get('mute'),
    '1',
  );
  assert.equal(trailerUrl(youtube.url), youtube.url);
  assert.equal(trailerSource('https://rutube.ru/video/abcdef/')?.hover, false);
  assert.equal(
    trailerSource('https://vkvideo.ru/video_ext.php?oid=-10&id=15')?.hover,
    false,
  );
  assert.equal(
    trailerSource('https://cdn.example.test/a.mp4?token=abc')?.kind,
    'video',
  );
  assert.equal(trailerSource('https://cdn.example.test/a.webm')?.hover, true);
  for (const url of [
    'http://example.test/a.mp4',
    'javascript:alert(1)',
    'data:video/mp4;base64,AAA',
    'https://test/a.html',
    'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
    'https://user:pass@example.test/a.mp4',
    'https://localhost/a.mp4',
    'https://127.0.0.1/a.mp4',
    'https://[::1]/a.mp4',
  ])
    assert.equal(trailerSource(url), null, url);
  assert.equal(trailerUrl(undefined), '');
  assert.throws(() => trailerUrl('https://example.test/iframe.html'));
  const input = {
    title: 'Трейлер',
    description: 'Описание',
    year: 2020,
    category: 'Фильм',
    genre: 'Драма',
    duration: 90,
    poster: 'https://example.test/a.png',
    watchUrl: 'https://youtu.be/dQw4w9WgXcQ',
  };
  assert.equal(parseMaterialInput(input).trailerUrl, '');
  assert.equal(
    parseMaterialInput({ ...input, trailerUrl: 'https://youtu.be/dQw4w9WgXcQ' })
      .trailerUrl,
    youtube.url,
  );
  assert.throws(() =>
    parseMaterialInput({ ...input, trailerUrl: 'javascript:alert(1)' }),
  );
});
test('rating border and score use the hero thresholds, unrated never looks like a low score', () => {
  for (const [rating, expected] of [
    [0, 'red'],
    [4.9, 'red'],
    [5, 'blue'],
    [6.9, 'blue'],
    [7, 'teal'],
    [8.49, 'teal'],
    [8.5, 'gold'],
    [10, 'gold'],
  ] as const)
    assert.equal(materialTone({ rating, ratingCount: 1 }), expected);
  assert.equal(materialTone({ rating: 9, ratingCount: 0 }), 'unrated');
  assert.equal(materialTone({ rating: NaN, ratingCount: 1 }), 'unrated');
});
test('video upload contract is separate from images, bounded, and checks MP4/WebM signatures', () => {
  assert.equal(MAX_TRAILER_BYTES, 40 * 1024 * 1024);
  assert(
    validTrailerHeader(
      Uint8Array.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]),
      'video/mp4',
    ),
  );
  assert(
    validTrailerHeader(Uint8Array.from([26, 69, 223, 163, 0]), 'video/webm'),
  );
  assert(
    !validTrailerHeader(Buffer.from('<script>alert(1)</script>'), 'video/mp4'),
  );
  assert(!validTrailerHeader(Uint8Array.from([26, 69, 223, 163]), 'image/png'));
  assert(!validTrailerHeader(new Uint8Array(), 'video/webm'));
});
