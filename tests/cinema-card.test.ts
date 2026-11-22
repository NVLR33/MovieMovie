import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCinemaCard, cinemaCardShareText, selectCinemaCrown, splitCinemaNames, type CinemaCardFilm } from '../src/lib/cinema-card';
import { CINEMA_CARD_THEMES, cinemaCardDimensions, escapeCardXml, renderCinemaCardSvg, type CinemaCardTheme } from '../src/lib/cinema-card-art';
import { getOwnershipStats } from '../src/lib/ownership';

const films: CinemaCardFilm[] = [
  { id: 1, genre: 'Драма, Фантастика, драма', cast: 'Том Харди, Киллиан Мёрфи, том харди', duration: 120, episodes: null, category: 'Фильм' },
  { id: 2, genre: 'Драма; Триллер', cast: 'Киллиан Мёрфи\nЭмили Блант', duration: 45, episodes: 6, category: 'Сериал' },
  { id: 3, genre: '', duration: 60, episodes: null, category: 'Фильм' },
];
const user = { id: 7, username: 'Киноман' };
const input = { user, films, watches: [{ movieId: 1 }, { movieId: 1 }, { movieId: 2 }, { movieId: 3 }], progress: {}, ownership: {} };

test('normalizes whitespace and repeated names while retaining readable display names', () => {
  assert.deepEqual(splitCinemaNames(' Том   Харди,том харди;\nКиллиан Мёрфи\r\n ;'), ['Том Харди', 'Киллиан Мёрфи']);
});

test('counts rewatches, all three genres, full episodic time and actual cast coverage', () => {
  const card = buildCinemaCard(input);
  assert.equal(card.totalMinutes, 120 * 2 + 45 * 6 + 60);
  assert.equal(card.watches, 4);
  assert.equal(card.uniqueTitles, 3);
  assert.deepEqual(card.topGenres, [
    { name: 'Драма', count: 3, percentage: 75 },
    { name: 'Фантастика', count: 2, percentage: 50 },
    { name: 'Триллер', count: 1, percentage: 25 },
  ]);
  assert.deepEqual(card.topActor, { name: 'Киллиан Мёрфи', count: 3 });
  assert.deepEqual(card.castCoverage, { known: 3, total: 4 });
});

test('ties in genres and actors resolve alphabetically, not by database order', () => {
  const card = buildCinemaCard({ ...input, watches: [{ movieId: 2 }] });
  const reverse = buildCinemaCard({ ...input, films: [...films].reverse(), watches: [{ movieId: 2 }] });
  assert.deepEqual(card, reverse);
  assert.equal(card.topActor?.name, 'Киллиан Мёрфи');
  assert.equal(card.topGenres[0].name, 'Драма');
});

test('empty histories and missing casts do not invent genres, actors or crowns', () => {
  const empty = buildCinemaCard({ ...input, watches: [] });
  assert.equal(empty.totalMinutes, 0);
  assert.equal(empty.topActor, null);
  assert.deepEqual(empty.topGenres, []);
  assert.equal(empty.crown, null);
  const unknown = buildCinemaCard({ ...input, watches: [{ movieId: 3 }, { movieId: 999 }] });
  assert.equal(unknown.watches, 1);
  assert.equal(unknown.topActor, null);
  assert.deepEqual(unknown.castCoverage, { known: 0, total: 1 });
});

test('bad duration values cannot poison the infographic totals', () => {
  const card = buildCinemaCard({ ...input, films: [{ ...films[0], duration: Number.NaN }, { ...films[1], duration: -10, episodes: -5 }] });
  assert.equal(card.totalMinutes, 0);
});

test('crown selects the rarest earned tier, not a rarer unearned achievement', () => {
  const crown = selectCinemaCrown({ watch: 10, night: 0, ratings: 1 }, {
    watch: [getOwnershipStats(80, 100), getOwnershipStats(12, 100), getOwnershipStats(1, 100)],
    night: [getOwnershipStats(1, 100)], ratings: [getOwnershipStats(20, 100)],
  });
  assert.equal(crown?.id, 'watch');
  assert.equal(crown?.tier, 2);
  assert.equal(crown?.stats.percentage, 12);
});

test('crown ties prefer a higher tier and then a stable id', () => {
  const stats = getOwnershipStats(5, 100);
  const crown = selectCinemaCrown({ watch: 10, night: 1, ratings: 10 }, { watch: [stats, stats], night: [stats], ratings: [stats, stats] });
  assert.equal(crown?.id, 'ratings');
  assert.equal(crown?.tier, 2);
});

test('crown excludes unavailable or contradictory community ownership', () => {
  assert.equal(selectCinemaCrown({ watch: 100 }, {}), null);
  assert.equal(selectCinemaCrown({ watch: 100 }, { watch: [getOwnershipStats(0, 0), getOwnershipStats(0, 100)] }), null);
});

test('share text is a real snapshot and does not serialize private profile fields', () => {
  const card = buildCinemaCard({ ...input, user: { ...user, email: 'private@example.test', passwordHash: 'secret' } as typeof user });
  const text = cinemaCardShareText(card);
  assert.match(text, /Киллиан Мёрфи/);
  assert.match(text, /9 ч 30 мин/);
  assert.equal(text.includes('private@example.test'), false);
  assert.equal(JSON.stringify(card).includes('secret'), false);
});

test('SVG escapes user-controlled text instead of including HTML or remote resources', () => {
  const card = buildCinemaCard({ ...input, user: { ...user, username: '<script>alert("x")</script>' } });
  const svg = renderCinemaCardSvg(card, { theme: 'aurora', format: 'square', profileUrl: 'example.test/user/7?x="<&', logoData: 'https://evil.test/image.png' });
  assert.equal(svg.includes('<script>'), false);
  assert.match(svg, /&lt;script&gt;/);
  assert.equal(svg.includes('https://evil.test'), false);
  assert.equal(svg.includes('<foreignObject'), false);
  assert.equal(escapeCardXml('&<>"\''), '&amp;&lt;&gt;&quot;&apos;');
});

for (const theme of Object.keys(CINEMA_CARD_THEMES) as CinemaCardTheme[]) {
  for (const format of ['square', 'story'] as const) {
    test(`${theme} ${format} embeds the original PNG and exports the expected dimensions`, () => {
      const card = buildCinemaCard(input);
      const svg = renderCinemaCardSvg(card, { theme, format, profileUrl: 'moviemovie.ru/user/7', logoData: 'data:image/png;base64,AAAA' });
      const dimensions = cinemaCardDimensions(format);
      assert.match(svg, new RegExp(`width="1080" height="${dimensions.height}"`));
      assert.match(svg, /href="data:image\/png;base64,AAAA"/);
      assert.match(svg, /Киллиан Мёрфи/);
      assert.match(svg, /Состав известен: 3 из 4/);
      assert.equal(svg.includes('NaN'), false);
      assert.equal(svg.includes('undefined'), false);
    });
  }
}
