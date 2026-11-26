// Real production app + marker-guarded disposable DB. No production data or migrations.
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
    (a) => !['--single-process', '--disable-web-security'].includes(a),
  ),
  headless: true,
});
const ids = [];
let userId;
try {
  const stamp = Date.now(),
    genre = 'Рулетка ' + stamp;
  for (const [index, [category, duration]] of [
    ['Фильм', 100],
    ['Сериал', 45],
    ['Фильм', 90],
    ['Фильм', 175],
    ['Фильм', 0],
    ['Аниме-фильм', 80],
  ].entries()) {
    ids.push(
      (
        await db.query(
          "insert into mg_movies(title,description,category,genre,year,duration,poster)values($1,'Fixture',$2,$3,2024,$4,'/brand/moviemovie-logo.png')returning id",
          ['Рулетка ' + index, category, genre, duration],
        )
      ).rows[0].id,
    );
  }
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    }),
    page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (
      m.type() === 'error' &&
      /hydration|Minified React error/i.test(m.text())
    )
      errors.push(m.text());
  });
  await context.addInitScript(() =>
    localStorage.setItem('mg_season_mode', 'off'),
  );
  const signup = await context.request.post(base + '/api/auth', {
    data: {
      action: 'register',
      email: `roulette-${stamp}@example.test`,
      username: 'Roulette' + stamp,
      password: 'roulette-test-password',
    },
  });
  assert.equal(signup.status(), 200);
  userId = (await signup.json()).user.id;
  await db.query('insert into mg_watches(user_id,movie_id)values($1,$2)', [
    userId,
    ids[0],
  ]);
  for (const id of [ids[1], ids[2]])
    await db.query('insert into mg_bookmarks(user_id,movie_id)values($1,$2)', [
      userId,
      id,
    ]);
  const ready = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/data',
  );
  await page.goto(base);
  await ready;
  await page
    .getByRole('button', { name: 'Крутить рулетку', exact: true })
    .click();
  const dialog = page.locator('dialog.cinema-roulette');
  await dialog.waitFor();
  const setMode = async (mode) => {
    await dialog.locator(`.rr-modes button[data-mode=${mode}]`).click();
    await page.waitForFunction(
      (mode) =>
        document.querySelector('dialog.cinema-roulette')?.dataset.mode === mode,
      mode,
    );
  };
  await dialog.locator('.rr-filters summary').click();
  await dialog.getByLabel('Жанр', { exact: true }).selectOption(genre);
  const poolCount = async (count) => {
    await page.waitForFunction(
      (count) =>
        document
          .querySelector('.rr-status')
          ?.textContent?.includes(`В розыгрыше: ${count} ·`),
      count,
    );
  };
  await poolCount(6);
  const draw = async () => {
    await dialog.locator('.rr-spin').click();
    await dialog.locator('.rr-result').waitFor();
    return Number(
      await dialog.locator('.rr-result').getAttribute('data-winner-id'),
    );
  };
  const seen = new Set();
  for (let i = 0; i < 6; i++) {
    const id = await draw();
    assert(ids.includes(id));
    assert(!seen.has(id), 'No repeated titles before pool exhaustion');
    seen.add(id);
  }
  const last = Number(
    await dialog.locator('.rr-result').getAttribute('data-winner-id'),
  );
  assert.notEqual(await draw(), last);
  await setMode('unwatched');
  await poolCount(5);
  for (let i = 0; i < 3; i++) assert.notEqual(await draw(), ids[0]);
  await setMode('watchlist');
  await poolCount(2);
  for (let i = 0; i < 3; i++) assert([ids[1], ids[2]].includes(await draw()));
  await setMode('evening');
  await poolCount(3);
  for (let i = 0; i < 3; i++)
    assert([ids[0], ids[2], ids[5]].includes(await draw()));
  await dialog.getByLabel('Время на фильм').selectOption('180');
  await poolCount(4);
  await dialog.getByLabel('Формат', { exact: true }).selectOption('Сериал');
  await dialog
    .getByText('Пока нет подходящих историй', { exact: true })
    .waitFor();
  assert.equal(await dialog.locator('.rr-spin').count(), 0);
  await dialog.getByLabel('Формат', { exact: true }).selectOption('all');
  // Single candidate, reduced-motion result is immediate, real bookmark persists.
  await setMode('unwatched');
  await dialog
    .getByLabel('Формат', { exact: true })
    .selectOption('Аниме-фильм');
  await poolCount(1);
  assert.equal(await draw(), ids[5]);
  assert.equal(
    await dialog.locator('.rr-strip').getAttribute('data-phase'),
    'done',
  );
  await dialog
    .getByRole('button', { name: 'Буду смотреть', exact: true })
    .click();
  await dialog.getByRole('button', { name: 'В списке', exact: true }).waitFor();
  assert(
    (
      await (await context.request.get(base + '/api/data')).json()
    ).bookmarks.some((b) => b.movieId === ids[5]),
  );
  // Geometry and distinct scenery across all four modes, two themes and mobile/desktop.
  await dialog.getByRole('button', { name: 'Закрыть рулетку' }).click();
  fs.mkdirSync('/tmp/mm-roulette-screenshots', { recursive: true });
  for (const theme of ['Тёмная', 'Светлая']) {
    await chooseTheme(page, theme);
    await page
      .getByRole('button', { name: 'Крутить рулетку', exact: true })
      .click();
    const looks = new Set();
    for (const mode of ['surprise', 'unwatched', 'watchlist', 'evening']) {
      await setMode(mode);
      looks.add(
        await dialog
          .locator('.rr-theatre')
          .evaluate((el) => getComputedStyle(el).backgroundImage),
      );
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert(
          await dialog.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return (
              r.left >= 0 &&
              r.right <= innerWidth + 1 &&
              r.top >= 0 &&
              r.bottom <= innerHeight + 1 &&
              el.scrollWidth <= el.clientWidth + 1
            );
          }),
          `${theme}/${mode}/${width} bounds`,
        );
        await dialog.locator('.rr-spin').click();
        await dialog.locator('.rr-result').waitFor();
        const delta = await dialog.locator('.rr-theatre').evaluate((el) => {
          const a = el.querySelector('.is-winner').getBoundingClientRect(),
            b = el.querySelector('.rr-selector').getBoundingClientRect();
          return Math.abs(a.left + a.width / 2 - b.left - b.width / 2);
        });
        assert(delta < 1, `${width} reel winner centered: ${delta}`);
      }
      await page.setViewportSize({ width: 768, height: 1100 });
      await dialog.screenshot({
        path: `/tmp/mm-roulette-screenshots/${theme === 'Тёмная' ? 'dark' : 'light'}-${mode}.png`,
      });
    }
    assert.equal(looks.size, 4, 'Four distinct visual scenes');
    await dialog.getByRole('button', { name: 'Закрыть рулетку' }).click();
  }
  // Animation supports skip, resizing, Escape and closing even before its timer ends.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page
    .getByRole('button', { name: 'Крутить рулетку', exact: true })
    .click();
  await dialog.locator('.rr-spin').click();
  await dialog.locator('.rr-strip[data-phase=spinning]').waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog.getByRole('button', { name: 'Пропустить анимацию' }).click();
  await dialog.locator('.rr-result').waitFor();
  await dialog.locator('.rr-spin').click();
  await dialog.locator('.rr-result').waitFor(); // Natural animation completion, not just skip.
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press('Tab');
    assert(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
      'Native dialog traps focus',
    );
  }
  await dialog.locator('.rr-spin').click();
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  await page
    .getByRole('button', { name: 'Крутить рулетку', exact: true })
    .click();
  await dialog.locator('.rr-spin').click();
  await dialog.getByRole('button', { name: 'Закрыть рулетку' }).click();
  await dialog.waitFor({ state: 'detached' });
  // Guest modes explain authentication rather than silently using the full catalog.
  const guest = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    }),
    gp = await guest.newPage();
  await guest.addInitScript(() =>
    localStorage.setItem('mg_season_mode', 'off'),
  );
  await gp.goto(base);
  await gp
    .getByRole('button', { name: 'Крутить рулетку', exact: true })
    .click();
  for (const mode of ['unwatched', 'watchlist']) {
    await gp.locator(`.rr-modes button[data-mode=${mode}]`).click();
    await gp.getByText('Твоя личная подборка', { exact: true }).waitFor();
    assert.equal(await gp.locator('.rr-spin').count(), 0);
  }
  await gp.getByRole('button', { name: 'Войти', exact: true }).click();
  await gp.getByRole('heading', { name: 'С возвращением!' }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    'Passed four-mode roulette: actual watched/watchlist data, runtime and exact filters, no repeats, real bookmarking, guest auth/empty states, four distinct scenes × two themes × four widths, centered winners, immediate reduced-motion, animated skip/resize/Escape/close cleanup. Screenshots /tmp/mm-roulette-screenshots',
  );
} finally {
  await browser.close();
  if (ids.length) {
    for (const table of ['mg_ratings', 'mg_watches', 'mg_bookmarks'])
      await db.query(`delete from ${table} where movie_id=any($1::int[])`, [
        ids,
      ]);
    await db.query('delete from mg_movies where id=any($1::int[])', [ids]);
  }
  if (userId) await db.query('delete from mg_users where id=$1', [userId]);
  await db.end();
}
