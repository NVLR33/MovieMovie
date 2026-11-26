import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { playbackSource, playbackUrl } from '../src/lib/playback-source';
import { parseMaterialInput } from '../src/lib/material-input';
import MaterialPlayer from '../src/components/material-player';
const id = '0123456789abcdef0123456789abcdef';
test('viewing sources use a strict provider allowlist and discard autoplay/HTML parameters', () => {
  assert.equal(
    playbackUrl(`https://rutube.ru/video/${id}/?autoplay=1`),
    `https://rutube.ru/play/embed/${id}/`,
  );
  assert.equal(
    playbackUrl('https://vkvideo.ru/video-12_34?autoplay=1'),
    'https://vk.com/video_ext.php?oid=-12&id=34',
  );
  assert.equal(
    playbackUrl(
      'https://vk.com/video_ext.php?oid=-12&id=34&hash=abc&autoplay=1',
    ),
    'https://vk.com/video_ext.php?oid=-12&id=34&hash=abc',
  );
  const privateVideo = playbackSource(
    `https://rutube.ru/play/embed/${id}/?p=share-key`,
  )!;
  assert.match(privateVideo.url, /p=share-key/);
  assert.match(privateVideo.externalUrl, /p=share-key/);
  for (const value of [null, undefined, '', '  '])
    assert.equal(playbackUrl(value), '');
});
test('direct MP4 is an HTTPS browser source, not a server download endpoint', () => {
  const url = 'https://cdn.moviemovie-demo.org/movie.MP4?signature=abc';
  assert.deepEqual(playbackSource(url), {
    kind: 'video',
    provider: 'MP4',
    url,
    externalUrl: url,
  });
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,hi',
    '//vk.com/video-1_2',
    '<iframe src="https://vk.com/video_ext.php?oid=-1&id=2"></iframe>',
    'http://cdn.domain.org/a.mp4',
    'https://cdn.domain.org/a.m3u8',
    'https://cdn.domain.org/a.webm',
    'https://user:secret@cdn.domain.org/a.mp4',
    'https://cdn.domain.org:8443/a.mp4',
    'https://127.0.0.1/a.mp4',
    'https://2130706433/a.mp4',
    'https://[::1]/a.mp4',
    'https://localhost/a.mp4',
    'https://localhost./a.mp4',
    'https://server.internal/a.mp4',
    'https://host.local/a.mp4',
    'https://vk.com.evil.org/video_ext.php?oid=1&id=2',
    'https://vk.com/video_ext.php?oid=x&id=2',
    'https://rutube.ru/video/invalid/',
    'https://youtube.com/watch?v=dQw4w9WgXcQ',
    { url: 'https://cdn.domain.org/a.mp4' },
    123,
    'x'.repeat(4097),
  ])
    assert.equal(playbackSource(value), null, JSON.stringify(value));
});
test('playback is separate from both trailers and external destinations in material input', () => {
  const body = {
    title: 'Материал',
    description: 'Описание',
    category: 'Фильм',
    year: 2024,
    duration: 90,
    poster: 'https://cdn.domain.org/a.jpg',
    watchUrl: 'https://example.org/watch',
    trailerUrl: 'https://youtu.be/dQw4w9WgXcQ',
    playbackUrl: 'https://vkvideo.ru/video-1_2',
  };
  const input = parseMaterialInput(body);
  assert.equal(input.playbackUrl, 'https://vk.com/video_ext.php?oid=-1&id=2');
  assert.equal(input.watchUrl, body.watchUrl);
  assert.match(input.trailerUrl, /youtube-nocookie/);
  assert.throws(() =>
    parseMaterialInput({ ...body, playbackUrl: 'https://example.org/page' }),
  );
});
test('SSR renders only a watch button, never a provider request or player before consent', () => {
  const html = renderToStaticMarkup(
    createElement(MaterialPlayer, {
      url: 'https://vkvideo.ru/video-1_2',
      title: 'Материал',
    }),
  );
  assert.match(html, /Смотреть/);
  assert.doesNotMatch(html, /<iframe|<video|preconnect|video_ext.php/);
  assert.equal(
    renderToStaticMarkup(
      createElement(MaterialPlayer, {
        url: 'javascript:alert(1)',
        title: 'Материал',
      }),
    ),
    '',
  );
});
