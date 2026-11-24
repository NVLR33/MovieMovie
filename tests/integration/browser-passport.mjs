import { chooseTheme } from './settings-controls.mjs';
// Production passport, real registered account and isolated SQL fixture only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { Client } from 'pg';
const deps = createRequire(
  process.env.UI_TEST_DEPS
    ? resolve(process.env.UI_TEST_DEPS, 'package.json')
    : import.meta.url,
);
const { chromium: pw } = deps('playwright-core'),
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
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      reducedMotion: 'reduce',
    }),
    page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-11-22T12:00:00Z'));
  const signup = await context.request.post(base + '/api/auth', {
    data: {
      action: 'register',
      email: `passport-${Date.now()}@example.test`,
      username: `Passport${Date.now()}`,
      password: 'passport-isolated-browser-password',
    },
  });
  assert.equal(signup.status(), 200);
  userId = (await signup.json()).user.id;
  await db.query('update mg_users set xp=6650 where id=$1', [userId]);
  const rows = [
    ['Паспорт: северный свет', 'Драма', 'Россия', '2026-11-22T10:00:00Z'],
    [
      'Паспорт: японский кадр',
      'Аниме, Драма',
      'Япония',
      '2026-11-21T10:00:00Z',
    ],
    [
      'Паспорт: французский вечер',
      'Комедия',
      'Франция',
      '2026-11-20T10:00:00Z',
    ],
    ['Паспорт: осенний сеанс', 'Триллер', 'США', '2026-10-10T10:00:00Z'],
    ['Паспорт: новое направление', 'Драма', 'Италия', null],
  ];
  for (const [title, genre, country, watchedAt] of rows) {
    const id = (
      await db.query(
        "insert into mg_movies(title,description,category,genre,year,duration,poster,country)values($1,'Passport local fixture','Фильм',$2,2024,95,'/brand/moviemovie-logo.png',$3)returning id",
        [title, genre, country],
      )
    ).rows[0].id;
    ids.push(id);
    if (watchedAt)
      await db.query(
        'insert into mg_watches(user_id,movie_id,watched_at)values($1,$2,$3)',
        [userId, id, watchedAt],
      );
  }
  await page.goto(base + '/profile');
  await page
    .getByRole('region', { name: 'Личный кинопаспорт', exact: true })
    .waitFor();
  await page.locator('.passport-globe').waitFor();
  assert.equal(
    await page.locator('.passport-level-banner .hud-level-number').innerText(),
    '14',
  );
  assert(
    (
      await page.locator('.passport-level-banner .hud-level-meta').innerText()
    ).includes('350'),
  );
  const boxes = await page
    .locator('.passport-level-banner,.profile-section-tabs')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
  assert(boxes[0] < boxes[1], 'XP must be at the top of profile');
  assert.equal(
    await page.locator('.passport-streak-number strong').innerText(),
    '3',
  );
  assert.equal(await page.locator('.passport-week .is-active').count(), 3);
  assert.equal(
    await page.locator('.passport-big-number').innerText(),
    '4\nстран открыто через кино',
  );
  assert.equal(
    await page.locator('.passport-genre-visual h3').innerText(),
    'Драма',
  );
  assert.equal(await page.locator('.passport-donut b').innerText(), '50%');
  await page.getByRole('button', { name: 'Аниме 17%', exact: true }).click();
  assert.equal(
    await page.locator('.passport-genre-visual h3').innerText(),
    'Аниме',
  );
  await page.getByRole('button', { name: 'Драма 50%', exact: true }).click();
  await page.locator('.passport-method summary').click();
  assert(
    (await page.locator('.passport-method p').innerText()).includes('поровну'),
  );
  await page.locator('.passport-method summary').click();
  const first = await page
    .locator('.passport-country[data-country="RU"]')
    .getAttribute('d');
  await page
    .getByRole('button', { name: 'Повернуть глобус вправо', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  assert.notEqual(
    await page
      .locator('.passport-country[data-country="RU"]')
      .getAttribute('d'),
    first,
  );
  await page
    .getByRole('combobox', { name: 'Страна в кинопаспорте', exact: true })
    .selectOption('JP');
  await page
    .locator('.passport-country-detail')
    .getByRole('button', { name: 'Паспорт: японский кадр', exact: true })
    .waitFor();
  assert.equal(
    await page
      .locator('.passport-country[data-country="JP"]')
      .getAttribute('class'),
    'passport-country is-visited is-picked',
  );
  fs.mkdirSync('/tmp/mm-passport-screenshots', { recursive: true });
  await page
    .locator('.passport-grid')
    .screenshot({
      path: '/tmp/mm-passport-screenshots/passport-dark-desktop.png',
      animations: 'disabled',
    });
  for (const width of [320, 360, 390, 600, 760, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Passport overflow at ${width}`,
    );
    const globe = await page.locator('.passport-globe').boundingBox();
    assert(globe && globe.width > 160);
    const controls = await page
      .locator('.passport-globe-controls button')
      .evaluateAll((els) =>
        els.map((e) => ({
          w: e.getBoundingClientRect().width,
          h: e.getBoundingClientRect().height,
        })),
      );
    assert(controls.every((b) => b.w >= 44 && b.h >= 44));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator('.passport-world')
    .screenshot({
      path: '/tmp/mm-passport-screenshots/passport-world-mobile.png',
      animations: 'disabled',
    });
  await page
    .locator('.passport-genres')
    .screenshot({
      path: '/tmp/mm-passport-screenshots/passport-genres-mobile.png',
      animations: 'disabled',
    });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() => scrollTo(0, 0));
  await chooseTheme(page, 'Светлая');
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === 'light',
  );
  await page.locator('.hud-xp-chip').focus();
  await page.mouse.move(200, 400);
  await page
    .locator('.passport-grid')
    .screenshot({
      path: '/tmp/mm-passport-screenshots/passport-light-desktop.png',
      animations: 'disabled',
    });
  await page
    .getByRole('button', { name: 'Открыть полный атлас', exact: true })
    .click();
  await page.waitForURL('**/world?mode=watched&country=JP');
  await page
    .getByRole('button', { name: 'Мои открытия', exact: true })
    .and(page.locator('[aria-pressed="true"]'))
    .waitFor();
  assert.equal(
    await page
      .getByRole('combobox', { name: 'Выбранная страна', exact: true })
      .inputValue(),
    'JP',
  );
  assert.equal(await page.locator('.world-film').count(), 1);
  assert.equal(
    await page.locator('.world-film h3').innerText(),
    'Паспорт: японский кадр',
  );
  await page.goto(base + '/profile');
  await page.locator('.passport-next-title').click();
  await page.getByRole('button', { name: 'Титулы', exact: true }).waitFor();
  await page
    .getByRole('button', { name: 'Титулы', exact: true })
    .and(page.locator('[aria-pressed="true"]'))
    .waitFor();
  assert.equal(await page.locator('.cinema-passport').count(), 0);
  // Empty and stale-day states are driven by network snapshots, not invented numbers.
  await context.route('**/api/data', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({ response, json: { ...data, watches: [] } });
  });
  await page.goto(base + '/profile');
  await page.locator('.passport-globe').waitFor();
  assert.equal(
    await page.locator('.passport-streak-number strong').innerText(),
    '0',
  );
  await page.getByText('Чистая страница месяца', { exact: true }).waitFor();
  assert.equal(await page.locator('.passport-donut').count(), 0);
  assert.equal(await page.locator('.passport-country.is-visited').count(), 0);
  await page
    .getByRole('combobox', { name: 'Страна в кинопаспорте', exact: true })
    .selectOption('JP');
  assert(
    (await page.locator('.passport-country-detail').innerText()).includes(
      'ещё не смотрел',
    ),
  );
  await context.unroute('**/api/data');
  await page.clock.setFixedTime(new Date('2026-11-24T12:00:00Z'));
  await page.goto(base + '/profile');
  await page.locator('.passport-globe').waitFor();
  assert.equal(
    await page.locator('.passport-streak-number strong').innerText(),
    '0',
  );
  assert(
    (await page.locator('.passport-streak-number').innerText()).includes(
      'Рекорд: 3',
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    'Passed production cinema passport: real geographic globe/rotation/list, weighted monthly genre selection, streak/current/best/UTC gap, top XP, 8 responsive widths, full watched-atlas deep link, titles shortcut, empty states, dark/light. Screenshots /tmp/mm-passport-screenshots',
  );
} finally {
  await browser.close();
  if (userId)
    await db.query(
      'delete from mg_watches where user_id=$1 and movie_id=any($2::int[])',
      [userId, ids],
    );
  if (ids.length)
    await db.query('delete from mg_movies where id=any($1::int[])', [ids]);
  await db.end();
}
