// Production weekly chart + optimistic controls; fixture-guarded disposable SQL only.
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
const ids = [],
  viewers = [];
let userId;
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      reducedMotion: 'reduce',
    }),
    page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const stamp = Date.now(),
    signup = await context.request.post(base + '/api/auth', {
      data: {
        action: 'register',
        email: `pulse-${stamp}@example.test`,
        username: `Pulse${stamp}`,
        password: 'pulse-isolated-browser-password',
      },
    });
  assert.equal(signup.status(), 200);
  userId = (await signup.json()).user.id;
  for (let i = 0; i < 25; i++)
    viewers.push(
      (
        await db.query(
          'insert into mg_users(email,username)values($1,$2)returning id',
          [
            `pulse-viewer-${stamp}-${i}@example.test`,
            `PulseViewer${stamp}_${i}`,
          ],
        )
      ).rows[0].id,
    );
  for (let i = 0; i < 12; i++) {
    const id = (
      await db.query(
        "insert into mg_movies(title,description,category,genre,year,duration,poster,age_rating)values($1,$2,'Фильм','Драма',2024,113,'/brand/moviemovie-logo.png','16+')returning id",
        [
          `Пульс ${i + 1}`,
          'История о неожиданной встрече, которая меняет планы героев. Проверка длинного описания и читаемости недельного чарта без вымышленных пользовательских оценок.',
        ],
      )
    ).rows[0].id;
    ids.push(id);
    await db.query(
      `insert into mg_watches(user_id,movie_id,watched_at)select unnest($1::int[]),$2,now()+$3::interval`,
      [
        viewers.slice(0, i < 10 ? 25 - i : 25),
        id,
        i === 10 ? '-8 days' : i === 11 ? '1 day' : '-1 hour',
      ],
    );
  }
  const full = await (await context.request.get(base + '/api/data')).json(),
    publicResponse = await context.request.get(base + '/api/pulse'),
    snapshot = await publicResponse.json();
  assert.equal(publicResponse.status(), 200);
  assert.deepEqual(snapshot.weeklyPulse.entries, full.weeklyPulse.entries);
  assert.equal(snapshot.weeklyPulse.entries.length, 10);
  assert.deepEqual(
    snapshot.weeklyPulse.entries.map((e) => e.movieId),
    ids.slice(0, 10),
  );
  assert.equal(
    snapshot.weeklyPulse.entries.some(
      (e) => e.movieId === ids[10] || e.movieId === ids[11],
    ),
    false,
  );
  assert.deepEqual(Object.keys(snapshot.weeklyPulse.entries[0]).sort(), [
    'movieId',
    'viewers',
  ]);
  await page.goto(base + '/');
  const pulse = page.getByRole('region', {
    name: 'Кинопульс недели',
    exact: true,
  });
  await pulse.waitFor();
  await page.waitForFunction(
    () => document.querySelectorAll('.weekly-pulse-card').length === 10,
  );
  assert.equal(await pulse.locator('.weekly-pulse-lead').count(), 3);
  assert.equal(await pulse.locator('.weekly-pulse-small').count(), 7);
  assert.deepEqual(
    await pulse.locator('.weekly-pulse-place').allTextContents(),
    ['#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10'],
  );
  const leader = pulse.getByRole('article', {
      name: 'Место 1: Пульс 1',
      exact: true,
    }),
    save = leader.getByRole('button', {
      name: 'Смотреть позже: Пульс 1',
      exact: true,
    });
  assert.match(await leader.innerText(), /25/);
  assert.match(await leader.locator('.weekly-pulse-rating').innerText(), /—/);
  // A failed optimistic save must roll back. No second client store or fabricated XP.
  let release;
  await context.route('**/api/action', async (route) => {
    if (route.request().postDataJSON()?.action === 'bookmark') {
      await new Promise((resolve) => {
        release = resolve;
      });
      return route.fulfill({
        status: 500,
        json: { error: 'Изолированный тест отказа' },
      });
    }
    await route.continue();
  });
  await save.click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('.weekly-pulse-lead .weekly-pulse-save')
        ?.getAttribute('aria-pressed') === 'true',
  );
  assert.equal(await save.isDisabled(), true);
  release();
  await page.waitForFunction(
    () =>
      document
        .querySelector('.weekly-pulse-lead .weekly-pulse-save')
        ?.getAttribute('aria-pressed') === 'false',
  );
  await context.unroute('**/api/action');
  await save.click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('.weekly-pulse-lead .weekly-pulse-save')
        ?.getAttribute('aria-pressed') === 'true',
  );
  assert(
    (
      await (await context.request.get(base + '/api/data')).json()
    ).bookmarks.some((b) => b.movieId === ids[0]),
  );
  const guest = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    }),
    guestPage = await guest.newPage();
  guestPage.on('pageerror', (e) => errors.push(e.message));
  let pulseReads = 0;
  guestPage.on('request', (request) => {
    if (request.url().endsWith('/api/pulse')) pulseReads++;
  });
  await guestPage.goto(base + '/');
  const guestPulse = guestPage.getByRole('region', {
    name: 'Кинопульс недели',
    exact: true,
  });
  await guestPulse.locator('.weekly-pulse-card').first().waitFor();
  await guestPulse
    .getByRole('button', { name: 'Смотреть позже: Пульс 1', exact: true })
    .click();
  await guestPage.locator('.auth-modal').waitFor();
  await guestPage.locator('.auth-modal .modal-close').click();
  await leader
    .getByRole('button', { name: 'Отметить просмотр: Пульс 1', exact: true })
    .click();
  await leader
    .getByRole('button', { name: 'Просмотрено: Пульс 1', exact: true })
    .waitFor();
  assert.equal(
    await leader
      .getByRole('button', { name: 'Просмотрено: Пульс 1', exact: true })
      .isDisabled(),
    true,
  );
  await guestPage.waitForFunction(
    () =>
      document.querySelector('.weekly-pulse-lead .weekly-pulse-viewers b')
        ?.textContent === '26',
  );
  assert(pulseReads > 0, 'SSE should refresh the public weekly slice');
  const after = await (await context.request.get(base + '/api/data')).json();
  assert(after.watches.some((w) => w.movieId === ids[0]));
  assert.equal(after.weeklyPulse.entries[0].viewers, 26);
  fs.mkdirSync('/tmp/mm-weekly-pulse-screenshots', { recursive: true });
  await pulse.screenshot({
    path: '/tmp/mm-weekly-pulse-screenshots/pulse-dark.png',
    animations: 'disabled',
  });
  for (const width of [320, 360, 390, 600, 760, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Weekly pulse overflow ${width}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await pulse.locator('.weekly-pulse-rest').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(
    () => document.querySelector('.weekly-pulse-rest').scrollLeft > 0,
  );
  await pulse.locator('.weekly-pulse-lead').first().scrollIntoViewIfNeeded();
  await page.screenshot({
    path: '/tmp/mm-weekly-pulse-screenshots/pulse-mobile.png',
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator('.theme-menu').hover();
  await page.getByRole('button', { name: 'Светлая', exact: true }).click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === 'light',
  );
  await page.locator('.hud-xp-chip').focus();
  await page.mouse.move(400, 600);
  await pulse.screenshot({
    path: '/tmp/mm-weekly-pulse-screenshots/pulse-light.png',
    animations: 'disabled',
  });
  await leader
    .getByRole('link', { name: 'Открыть и оценить', exact: true })
    .click();
  await page.waitForURL(`**/movie/${ids[0]}`);
  // Small and empty real-time snapshots must not be padded with all-time catalog titles.
  await context.route('**/api/data', async (route) => {
    const response = await route.fetch(),
      data = await response.json();
    await route.fulfill({
      response,
      json: {
        ...data,
        weeklyPulse: {
          ...data.weeklyPulse,
          entries: data.weeklyPulse.entries.slice(0, 2),
        },
      },
    });
  });
  await page.goto(base + '/');
  await pulse.waitFor();
  await page.waitForFunction(
    () => document.querySelectorAll('.weekly-pulse-card').length === 2,
  );
  assert.equal(await pulse.locator('.weekly-pulse-rest').count(), 0);
  await context.unroute('**/api/data');
  await context.route('**/api/data', async (route) => {
    const response = await route.fetch(),
      data = await response.json();
    await route.fulfill({
      response,
      json: { ...data, weeklyPulse: { ...data.weeklyPulse, entries: [] } },
    });
  });
  await page.reload();
  await pulse
    .getByRole('heading', {
      name: 'Неделя только набирает обороты',
      exact: true,
    })
    .waitFor();
  assert.equal(await pulse.locator('.weekly-pulse-card').count(), 0);
  await guest.close();
  assert.deepEqual(errors, []);
  console.log(
    'Passed production weekly pulse: aggregate/private-data parity, rolling-window old/future exclusion, real top10/3+7 composition, optimistic save rollback/persistence, mark-watch persistence, public SSE chart update, guest gate, keyboard rail, 8 widths/dark/light, material link, small and empty snapshots. Screenshots /tmp/mm-weekly-pulse-screenshots',
  );
} finally {
  await browser.close();
  if (ids.length) {
    for (const table of ['mg_bookmarks', 'mg_watches', 'mg_ratings'])
      await db.query(`delete from ${table} where movie_id=any($1::int[])`, [
        ids,
      ]);
    await db.query('delete from mg_movies where id=any($1::int[])', [ids]);
  }
  await db.end();
}
