import { assertMaterialCovers } from './material-cover-contract.mjs';
import { chooseTheme } from './settings-controls.mjs';
// Real production app + disposable marker-guarded local SQL only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { Client } from 'pg';
const deps = createRequire(
    process.env.UI_TEST_DEPS
      ? resolve(process.env.UI_TEST_DEPS, 'package.json')
      : import.meta.url,
  ),
  { chromium: pw } = deps('playwright-core'),
  chromium = deps('@sparticuz/chromium').default;
const base = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:3000';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
assert.equal(
  new URL(process.env.AUDIT_DATABASE_URL).searchParams.get('host'),
  '/tmp/mm-audit-pg',
);
const db = new Client({ connectionString: process.env.AUDIT_DATABASE_URL });
await db.connect();
assert.equal(
  (await db.query("select value from mm_audit_fixture where key='isolated'"))
    .rows[0]?.value,
  'yes',
);
const browser = await pw.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter(
    (arg) => !['--single-process', '--disable-web-security'].includes(arg),
  ),
  headless: true,
});
const ids = [];
let userId;
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    }),
    page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const signup = await context.request.post(base + '/api/auth', {
    data: {
      action: 'register',
      email: `ranking-${Date.now()}@example.test`,
      username: `Ranking${Date.now()}`,
      password: 'ranking-isolated-browser-password',
    },
  });
  assert.equal(signup.status(), 200);
  userId = (await signup.json()).user.id;
  for (let i = 0; i < 12; i++) {
    const id = (
      await db.query(
        "insert into mg_movies(title,description,category,genre,year,duration,poster,views)values($1,'Ranking local fixture','Аниме-фильм','Драма',2024,90,'/brand/moviemovie-logo.png',$2)returning id",
        [`Открытие ${i + 1}`, i + 1],
      )
    ).rows[0].id;
    ids.push(id);
    await db.query(
      'insert into mg_ratings(user_id,movie_id,value)values($1,$2,$3)',
      [userId, id, 8 + (i % 3) * 0.5],
    );
    if (i >= 9)
      await db.query(
        'insert into mg_watches(user_id,movie_id,watched_at)values($1,$2,now())',
        [userId, id],
      );
    if (i >= 10)
      await db.query(
        'insert into mg_favorites(user_id,movie_id)values($1,$2)',
        [userId, id],
      );
  }
  const category = 'Аниме-фильм',
    indexUrl = base + '/top?category=' + encodeURIComponent(category);
  await page.goto(base + '/');
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  assert.equal(
    await page.locator('.material-top').count(),
    0,
    'Full ranking library must not appear on home',
  );
  const five = page.getByRole('region', {
    name: 'Топ-5 сообщества',
    exact: true,
  });
  await five.waitFor();
  assert.equal(await five.locator('.home-five-card').count(), 5);
  assert.equal(
    await five
      .locator('.home-five-number')
      .allTextContents()
      .then((values) => values.join(',')),
    '1,2,3,4,5',
  );
  await five.getByRole('button', { name: 'По любимому', exact: true }).click();
  const snapshot = await (await context.request.get(base + '/api/data')).json();
  assert.equal(
    await five.locator('.home-five-card').count(),
    Math.min(5, snapshot.films.filter((film) => film.favoriteCount > 0).length),
    'Only genuinely favorited titles fill this top',
  );
  assert.equal(
    await five.locator('.home-five-full').getAttribute('href'),
    '/top?metric=favorites&limit=10',
  );
  await five
    .getByRole('button', { name: 'По просмотрам', exact: true })
    .click();
  assert.equal(await five.locator('.home-five-card').count(), 5);
  assert.equal(
    await five.locator('.home-five-caption strong').first().innerText(),
    [...snapshot.films].sort(
      (a, b) =>
        (b.views || 0) - (a.views || 0) ||
        b.rating - a.rating ||
        b.ratingCount - a.ratingCount ||
        a.id - b.id,
    )[0].title,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await five.scrollIntoViewIfNeeded();
  await five
    .getByRole('button', { name: 'Следующие постеры', exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelector('.home-five-track').scrollLeft > 0,
  );
  await five.getByRole('button', { name: 'По рейтингу', exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('.home-five-track').scrollLeft === 0,
  );
  assert.equal(
    await five.locator('.home-five-track').evaluate((el) => el.scrollLeft),
    0,
  );
  fs.mkdirSync('/tmp/mm-ranking-screenshots', { recursive: true });
  await page.screenshot({
    path: '/tmp/mm-ranking-screenshots/home-five-mobile.png',
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await five.scrollIntoViewIfNeeded();
  await five.screenshot({
    path: '/tmp/mm-ranking-screenshots/home-five-dark.png',
    animations: 'disabled',
  });
  await five.getByRole('link', { name: 'Весь топ-10', exact: true }).click();
  await page.waitForURL('**/top?metric=rating&limit=10');
  await page.locator('.material-rank-item').first().waitFor();
  await assertMaterialCovers(page);
  await page.goto(indexUrl);
  const library = page.locator('.ranking-library');
  await library.waitFor();
  await page.waitForFunction(() =>
    document
      .querySelector('.ranking-tone-rating .ranking-list-progress')
      ?.textContent?.includes('из 10'),
  );
  assert.equal(await library.locator('.ranking-library-row').count(), 9);
  const ratingRows = library.locator('.ranking-tone-rating'),
    favoriteRows = library.locator('.ranking-tone-favorites');
  assert.match(
    await ratingRows.nth(2).locator('.ranking-list-progress').innerText(),
    new RegExp(
      `3 из ${snapshot.films.filter((film) => film.category === category && film.ratingCount > 0 && film.rating > 0).length}`,
    ),
  );
  assert.match(
    await favoriteRows.first().locator('.ranking-list-progress').innerText(),
    /2 из 2/,
  );
  assert.match(
    await favoriteRows.first().innerText(),
    /Весь список просмотрен/,
  );
  for (const row of await library.locator('.ranking-library-row').all())
    assert.equal(await row.locator('.ranking-cover').count(), 1);
  const target = await ratingRows.first().getAttribute('href');
  await ratingRows.first().click();
  await page.waitForURL('**' + target);
  assert.equal(await page.locator('.material-rank-item').count(), 10);
  const watchedDetail = await page.locator('.material-watched').count();
  assert(watchedDetail > 0 && watchedDetail <= 3);
  await page.goBack();
  await library.waitFor();
  assert.match(
    await ratingRows.first().locator('.ranking-list-progress').innerText(),
    new RegExp(`${watchedDetail} из 10`),
  );
  await ratingRows.nth(2).click();
  await page.waitForURL('**/top?metric=rating&limit=100&category=*');
  assert.equal(
    await page.locator('.material-rank-item').count(),
    snapshot.films.filter(
      (film) =>
        film.category === category && film.ratingCount > 0 && film.rating > 0,
    ).length,
  );
  await page.getByRole('button', { name: 'По любимому', exact: true }).click();
  await page.waitForFunction(
    () => new URLSearchParams(location.search).get('metric') === 'favorites',
  );
  assert.equal(await page.locator('.material-rank-item').count(), 2);
  assert.equal(
    await page.locator('.material-score-primary').first().innerText(),
    '1',
  );
  await page.reload();
  assert.equal(
    await page
      .getByRole('button', { name: 'По любимому', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  );
  await page
    .getByRole('link', { name: 'Все списки рейтингов', exact: true })
    .click();
  await library.waitFor();
  assert.equal(new URL(page.url()).searchParams.get('category'), category);
  fs.mkdirSync('/tmp/mm-ranking-screenshots', { recursive: true });
  await page.screenshot({
    path: '/tmp/mm-ranking-screenshots/library-dark.png',
    fullPage: true,
  });
  for (const width of [320, 360, 390, 600, 760, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 950 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Ranking library overflow ${width}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: '/tmp/mm-ranking-screenshots/library-mobile.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => scrollTo(0, 0));
  await chooseTheme(page, 'Светлая');
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === 'light',
  );
  await page.locator('.hud-xp-chip').focus();
  await page.screenshot({
    path: '/tmp/mm-ranking-screenshots/library-light.png',
    fullPage: true,
  });
  await page.goto(base + '/');
  await five.waitFor();
  await five.scrollIntoViewIfNeeded();
  await five.screenshot({
    path: '/tmp/mm-ranking-screenshots/home-five-light.png',
    animations: 'disabled',
  });
  await page.goto(indexUrl);
  await library.waitFor();
  // Empty category is honest: zero eligible titles, zero progress, no divide-by-zero ring.
  await library
    .getByRole('button', { name: 'Мультсериал', exact: true })
    .click();
  await page.waitForFunction(
    () =>
      new URLSearchParams(location.search).get('category') === 'Мультсериал',
  );
  assert.equal(
    await library.getByText('Пока нет материалов', { exact: true }).count(),
    9,
  );
  await library.locator('.ranking-library-row').first().click();
  await page.getByText('Этот топ ещё впереди', { exact: true }).waitFor();
  // Changing the real watch snapshot updates the overview, not a locally fabricated counter.
  await db.query('delete from mg_watches where user_id=$1 and movie_id=$2', [
    userId,
    ids[11],
  ]);
  await page.goto(indexUrl);
  await library.waitFor();
  await page.waitForFunction(() =>
    document
      .querySelectorAll('.ranking-tone-favorites .ranking-list-progress')[0]
      ?.textContent?.includes('1 из 2'),
  );
  // Guest sees no misleading 0% personal completion and all lists remain public.
  const guest = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    }),
    guestPage = await guest.newPage();
  guestPage.on('pageerror', (e) => errors.push(e.message));
  await guestPage.goto(indexUrl);
  await guestPage.locator('.ranking-library-row').first().waitFor();
  assert.equal(
    await guestPage.getByText('Доступен после входа', { exact: true }).count(),
    9,
  );
  await guestPage.locator('.ranking-tone-rating').first().focus();
  await guestPage.keyboard.press('Enter');
  await guestPage.locator('.material-ranking').waitFor();
  assert.equal(await guestPage.locator('.material-watched').count(), 0);
  await guest.route('**/api/data', async (route) => {
    const response = await route.fetch(),
      data = await response.json();
    await route.fulfill({
      response,
      json: {
        ...data,
        films: data.films.map((film) => ({
          ...film,
          ratingCount: 0,
          rating: 0,
          views: 0,
          favoriteCount: 0,
        })),
      },
    });
  });
  await guestPage.goto(base + '/');
  const emptyFive = guestPage.getByRole('region', {
    name: 'Топ-5 сообщества',
    exact: true,
  });
  await emptyFive
    .getByText('Этот топ пока ждёт первых зрительских действий.', {
      exact: true,
    })
    .waitFor();
  assert.equal(await emptyFive.locator('.home-five-card').count(), 0);
  await emptyFive
    .getByRole('button', { name: 'По любимому', exact: true })
    .click();
  assert.equal(await emptyFive.locator('.home-five-card').count(), 0);
  await guest.close();
  assert.deepEqual(errors, []);
  console.log(
    'Passed production ranking library: home top-five filters/posters/full-top navigation/local scroll, full library removed from home, 9 lists/real denominators/current watched intersection, category filters, old deep links, detail/back/browser history, metric persistence, empty and guest states, keyboard, 8 widths and dark/light. Screenshots /tmp/mm-ranking-screenshots',
  );
} finally {
  await browser.close();
  if (userId) {
    for (const table of ['mg_favorites', 'mg_watches', 'mg_ratings'])
      await db.query(
        `delete from ${table} where user_id=$1 and movie_id=any($2::int[])`,
        [userId, ids],
      );
  }
  if (ids.length)
    await db.query('delete from mg_movies where id=any($1::int[])', [ids]);
  await db.end();
}
