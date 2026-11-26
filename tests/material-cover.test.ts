import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import MaterialCover from '../src/components/material-cover';

const film = {
  title: 'Материал',
  poster: '/poster.png',
  category: 'Сериал',
  rating: 9,
  ratingCount: 12,
  ageRating: '16+',
};
const render = (props: Parameters<typeof MaterialCover>[0]) =>
  renderToStaticMarkup(createElement(MaterialCover, props));

test('shared cover has catalog rating and age chips independently of its section', () => {
  const html = render({ film, className: 'home-five-poster' });
  assert.match(html, /material-cover tone-gold home-five-poster/);
  assert.match(html, /cover-score card-score/);
  assert.match(html, /age-orange cover-age/);
  assert.match(html, /data-series="true"/);
  assert.doesNotMatch(html, /class="[^"]*series-poster|<button|<a /);
});
test('a missing poster uses the shared fallback, never a different movie', () => {
  const html = render({ film: {}, alt: 'Постер недоступен' });
  assert.match(html, /data-poster-state="fallback"/);
  assert.match(html, /tone-unrated/);
  assert.doesNotMatch(html, /<img|cover-score|dune/);
});
test('zero-vote rating is neutral and shows a dash', () => {
  const html = render({ film: { ...film, ratingCount: 0 } });
  assert.match(html, /tone-unrated/);
  assert.match(html, /—/);
  assert.doesNotMatch(html, />9\.0</);
});
test('tiny or game covers can omit metadata and do not load trailers on render', () => {
  const html = render({
    film: { ...film, trailerUrl: 'https://example.com/test.mp4' },
    badges: false,
    preview: false,
  });
  assert.doesNotMatch(
    html,
    /cover-score|cover-age|<video|<iframe|trailer-indicator/,
  );
  assert.match(html, /cinema-poster-image/);
});
