// Cross-page visual contract against the actual production build and isolated local SQL.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { chooseTheme } from './settings-controls.mjs';
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
  }),
  ids = [];
let userId;
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  await context.addInitScript(() => {
    localStorage.setItem('mg_season_mode', 'off');
  });
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (
      m.type() === 'error' &&
      /hydration|Minified React error/i.test(m.text())
    )
      errors.push(m.text());
  });
  const stamp = Date.now(),
    studio = 'DesignFixture' + stamp,
    signup = await context.request.post(base + '/api/auth', {
      data: {
        action: 'register',
        email: `design-${stamp}@example.test`,
        username: `Design${stamp}`,
        password: 'design-isolated-browser-password',
      },
    });
  assert.equal(signup.status(), 200);
  userId = (await signup.json()).user.id;
  for (let n = 0; n < 6; n++) {
    const id = (
      await db.query(
        "insert into mg_movies(title,description,category,genre,studio,year,duration,poster,country,age_rating,views)values($1,'Проверка общей визуальной системы','Фильм','Драма',$2,2024,100,$3,'Россия','12+',1000)returning id",
        [
          'Единый дизайн ' + n,
          studio,
          n === 5
            ? '/brand/intentional-missing-poster.png'
            : '/brand/moviemovie-logo.png',
        ],
      )
    ).rows[0].id;
    ids.push(id);
    await db.query(
      'insert into mg_ratings(user_id,movie_id,value)values($1,$2,9)',
      [userId, id],
    );
    await db.query('insert into mg_favorites(user_id,movie_id)values($1,$2)', [
      userId,
      id,
    ]);
    await db.query('insert into mg_watches(user_id,movie_id)values($1,$2)', [
      userId,
      id,
    ]);
  }
  assert.equal(
    (
      await fetch(base + '/api/trailers', {
        method: 'POST',
        headers: { 'Content-Type': 'video/mp4' },
        body: 'no',
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await context.request.post(base + '/api/trailers', {
        headers: { 'Content-Type': 'video/mp4' },
        data: 'no',
      })
    ).status(),
    403,
  );
  fs.mkdirSync('/tmp/mm-cards-screenshots', { recursive: true });
  // Five genuine tones plus one broken image, all isolated fixture data.
  for (let n = 0; n < 5; n++)
    await db.query('update mg_ratings set value=$1 where movie_id=$2', [
      [3, 5, 7, 9, 9][n],
      ids[n],
    ]);
  await db.query('delete from mg_ratings where movie_id=$1', [ids[4]]);
  await db.query('update mg_movies set trailer_url=$1 where id=$2', [
    'https://media.example.test/trailer.mp4',
    ids[0],
  ]);
  await page.route('https://media.example.test/**', async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.abort().catch(() => {});
  });
  const open = async (path) => {
    await page.goto(base + path);
    await page.locator('.content').waitFor();
  };
  const card = (n) =>
    page.locator('.film-card').filter({ hasText: 'Единый дизайн ' + n });
  await open('/catalog?studio=' + studio);
  await card(0).waitFor();
  for (const [n, tone] of ['red', 'blue', 'teal', 'gold', 'unrated'].entries())
    assert((await card(n).getAttribute('class')).includes('tone-' + tone));
  await card(5).locator('[data-poster-state="fallback"]').waitFor();
  for (const theme of ['dark', 'light']) {
    await chooseTheme(page, theme === 'dark' ? 'Тёмная' : 'Светлая');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const mode of ['cards', 'compact', 'list']) {
        await page
          .locator('.material-view-control button')
          .nth(['cards', 'compact', 'list'].indexOf(mode))
          .click();
        await page.locator('.material-view-' + mode).waitFor();
        const issues = await card(0).evaluate((el) => {
          const a = el.querySelector('.card-score').getBoundingClientRect(),
            b = el.querySelector('.card-favorite-btn').getBoundingClientRect(),
            p = el.querySelector('.poster-wrap').getBoundingClientRect();
          return {
            overlap:
              a.left < b.right &&
              a.right > b.left &&
              a.top < b.bottom &&
              a.bottom > b.top,
            overflow:
              Math.max(
                document.documentElement.scrollWidth,
                document.body.scrollWidth,
              ) >
              innerWidth + 2,
            scoreInside:
              a.left >= p.left &&
              a.right <= p.right + 1 &&
              a.bottom <= p.bottom + 1,
            height: a.height,
          };
        });
        assert(!issues.overlap, JSON.stringify({ width, mode, issues }));
        assert(!issues.overflow, JSON.stringify({ width, mode, issues }));
        assert(issues.scoreInside);
        assert(issues.height < 40);
        if (width === 390 || width === 1440)
          await page.screenshot({
            path: `/tmp/mm-cards-screenshots/catalog-${theme}-${width}-${mode}.png`,
            animations: 'disabled',
          });
      }
    }
  }
  await page.reload();
  await page.locator('.material-view-list').waitFor();
  await page.locator('.material-view-control button').first().click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await card(0).locator('.poster-wrap').hover();
  await page.waitForTimeout(850);
  assert.equal(
    await page.locator('.trailer-preview').count(),
    0,
    'reduced motion suppresses previews',
  );
  await page.mouse.move(0, 0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await card(0).locator('.poster-wrap').hover();
  await page.locator('.trailer-preview video').waitFor({ state: 'attached' });
  assert(
    await page.locator('.trailer-preview video').evaluate((el) => el.muted),
  );
  await page.mouse.move(0, 0);
  await page.locator('.trailer-preview').waitFor({ state: 'detached' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await db.query("update mg_users set role='admin' where id=$1", [userId]);
  const material = {
    action: 'movieSave',
    id: ids[0],
    title: 'Единый дизайн 0',
    description: 'Проверка трейлера',
    category: 'Фильм',
    genre: 'Драма',
    studio,
    year: 2024,
    duration: 100,
    poster: '/brand/moviemovie-logo.png',
    country: 'Россия',
    trailerUrl: 'https://media.example.test/trailer.mp4',
  };
  assert.equal(
    (
      await context.request.post(base + '/api/action', {
        data: {
          ...material,
          trailerUrl: 'https://example.test/arbitrary.html',
        },
      })
    ).status(),
    400,
  );
  assert.equal(
    (
      await context.request.post(base + '/api/action', { data: material })
    ).status(),
    200,
  );
  assert.equal(
    (await db.query('select trailer_url from mg_movies where id=$1', [ids[0]]))
      .rows[0].trailer_url,
    material.trailerUrl,
  );
  await open('/movie/' + ids[0]);
  const trailerButton = page.getByRole('button', {
    name: 'Трейлер',
    exact: true,
  });
  await trailerButton.click();
  await page.locator('.trailer-dialog[open] video').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('.trailer-dialog').waitFor({ state: 'detached' });
  assert(await trailerButton.evaluate((el) => el === document.activeElement));
  await open('/');
  await page.locator('.home-five-number').first().waitFor();
  assert(
    await page
      .locator('.home-five-number')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize) > 60),
  );
  await page
    .locator('.weekly-pulse-podium .weekly-pulse-card')
    .first()
    .waitFor();
  assert.equal(
    await page.locator('.weekly-pulse-podium .weekly-pulse-card').count(),
    3,
  );
  assert(
    (await page.locator('.weekly-pulse-rest .weekly-pulse-card').count()) > 0,
  );
  await page.screenshot({
    path: '/tmp/mm-cards-screenshots/home-restored.png',
    fullPage: true,
    animations: 'disabled',
  });
  // Touch must never start background video, but the explicit detail player remains available.
  const touch = await browser.newContext({
      isMobile: true,
      hasTouch: true,
      viewport: { width: 390, height: 844 },
    }),
    mobile = await touch.newPage();
  await mobile.goto(base + '/catalog?studio=' + studio);
  await mobile.locator('.film-card').first().waitFor();
  await mobile
    .locator('.film-card .poster-wrap')
    .first()
    .dispatchEvent('pointerenter', { pointerType: 'touch' });
  await mobile.waitForTimeout(800);
  assert.equal(await mobile.locator('.trailer-preview').count(), 0);
  await touch.close();
  assert.deepEqual(errors, []);
  console.log(
    'Passed card-only contract: restored home podium/ranks; 5 rating tones; no score/favorite overlap at 4 widths in 3 views and 2 themes; persisted layout; broken-poster fallback; reduced-motion/touch; muted hover with teardown; accessible detail trailer dialog. Screenshots /tmp/mm-cards-screenshots',
  );
} finally {
  await browser.close();
  if (ids.length) {
    for (const table of ['mg_favorites', 'mg_watches', 'mg_ratings'])
      await db.query(`delete from ${table} where movie_id=any($1::int[])`, [
        ids,
      ]);
    await db.query('delete from mg_movies where id=any($1::int[])', [ids]);
  }
  if(userId){await db.query('delete from mg_admin_audit where actor_id=$1',[userId]);await db.query('delete from mg_users where id=$1',[userId]);}
  await db.end();
}
