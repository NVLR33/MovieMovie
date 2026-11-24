// Actual production UI + API, disposable marker-guarded local PostgreSQL only.
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
    }),
    page = await context.newPage(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const stamp = Date.now(),
    signup = await context.request.post(base + '/api/auth', {
      data: {
        action: 'register',
        email: `series-nav-${stamp}@example.test`,
        username: `SeriesNav${stamp}`,
        password: 'series-navigation-isolated-password',
      },
    });
  assert.equal(signup.status(), 200);
  userId = (await signup.json()).user.id;
  async function fixture(title, numbers) {
    const id = (
      await db.query(
        "insert into mg_movies(title,description,category,genre,year,duration,poster) values($1,'Изолированная проверка переключения сезонов','Сериал','Драма',2024,45,'/brand/moviemovie-logo.png')returning id",
        [title],
      )
    ).rows[0].id;
    ids.push(id);
    for (const number of numbers) {
      const sid = (
        await db.query(
          'insert into mg_series_seasons(movie_id,number,title)values($1,$2,$3)returning id',
          [id, number, number === 1 ? 'Начало' : 'История ' + number],
        )
      ).rows[0].id;
      for (let n = 1; n <= 3; n++)
        await db.query(
          'insert into mg_series_episodes(season_id,number,title)values($1,$2,$3)',
          [sid, n, `Серия ${n} сезона ${number}`],
        );
    }
    return id;
  }
  const movieId = await fixture('Навигация по сезонам', [1, 2, 4]),
    manyId = await fixture('Длинный сериал', [1, 2, 3, 4, 5, 6, 7, 8]),
    singleId = await fixture('Один сезон', [1]),
    emptyId = await fixture('Сезоны ещё не внесены', []);
  const url = base + '/movie/' + movieId,
    panel = page.getByRole('region', { name: 'Сезоны и эпизоды', exact: true }),
    season = panel.locator('.series-season');
  async function expectSeason(number) {
    await page.locator('.hud-xp-chip').waitFor();
    await season
      .getByRole('heading', {
        name: new RegExp('^Сезон ' + number + '(?: ·|$)'),
      })
      .waitFor();
    assert.equal(await season.count(), 1);
    assert.equal(await season.locator('.series-episodes > li').count(), 3);
  }
  let seriesGets = 0;
  page.on('request', (r) => {
    if (r.method() === 'GET' && r.url().includes('/api/series?')) seriesGets++;
  });
  await page.goto(url);
  await expectSeason(1);
  assert.equal(
    await panel
      .getByRole('button', { name: 'Предыдущий сезон', exact: true })
      .isDisabled(),
    true,
  );
  const beforeGets = seriesGets;
  await panel
    .getByRole('button', { name: 'Сезон 2 3 эп.', exact: true })
    .click();
  await expectSeason(2);
  assert.equal(new URL(page.url()).searchParams.get('season'), '2');
  assert.equal(seriesGets, beforeGets, 'Season navigation reuses loaded data');
  await panel
    .getByRole('button', { name: 'Следующий сезон', exact: true })
    .click();
  await expectSeason(4);
  assert.equal(
    await panel
      .getByRole('button', { name: 'Следующий сезон', exact: true })
      .isDisabled(),
    true,
  );
  assert(
    await season
      .getByRole('heading')
      .evaluate((el) => el === document.activeElement),
  );
  await panel
    .getByRole('button', { name: 'Предыдущий сезон', exact: true })
    .click();
  await expectSeason(2);
  await page.goto(url);
  await expectSeason(2);
  await page.reload();
  await expectSeason(2);
  await page.goto(url + '?from=test&season=4#series-seasons');
  await expectSeason(4);
  await page.waitForFunction(() => document.activeElement?.tagName === 'H4');
  assert.equal(new URL(page.url()).searchParams.get('from'), 'test');
  // Copy failure has a usable manual alternative, preserving other query parameters.
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw Error('Clipboard disabled');
        },
      },
    }),
  );
  await panel
    .getByRole('button', { name: 'Ссылка на сезон', exact: true })
    .click();
  const link = panel.getByRole('textbox', {
    name: 'Ссылка на сезон',
    exact: true,
  });
  await link.waitFor();
  assert.equal(
    new URL(await link.inputValue()).searchParams.get('season'),
    '4',
  );
  assert.equal(
    new URL(await link.inputValue()).searchParams.get('from'),
    'test',
  );
  const xp = (await db.query('select xp from mg_users where id=$1', [userId]))
    .rows[0].xp;
  await season
    .getByRole('combobox', { name: 'Оценка сезона 4', exact: true })
    .selectOption('9.5');
  await panel.getByText('Сохранено', { exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('season'), '4');
  await season
    .getByRole('combobox', { name: 'Оценка: сезон 4, эпизод 1', exact: true })
    .selectOption('8');
  await page.waitForFunction(
    () =>
      document.querySelector('.series-message')?.textContent === 'Сохранено' &&
      document.querySelector('.series-panel')?.getAttribute('aria-busy') ===
        'false',
  );
  assert.equal(
    (await db.query('select xp from mg_users where id=$1', [userId])).rows[0]
      .xp,
    xp,
  );
  await page.reload();
  await expectSeason(4);
  assert.equal(
    await season
      .getByRole('combobox', { name: 'Оценка сезона 4', exact: true })
      .inputValue(),
    '9.5',
  );
  assert.equal(
    await season
      .getByRole('combobox', { name: 'Оценка: сезон 4, эпизод 1', exact: true })
      .inputValue(),
    '8',
  );
  // Rating failure keeps confirmed values and the active season, with no extra XP.
  await context.route('**/api/series', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 500,
          json: { error: 'Тестовая ошибка сохранения' },
        })
      : route.continue(),
  );
  await season
    .getByRole('combobox', { name: 'Оценка сезона 4', exact: true })
    .selectOption('10');
  await panel.getByRole('alert').waitFor();
  assert.equal(
    await season
      .getByRole('combobox', { name: 'Оценка сезона 4', exact: true })
      .inputValue(),
    '9.5',
  );
  await expectSeason(4);
  await context.unroute('**/api/series');
  fs.mkdirSync('/tmp/mm-series-screenshots', { recursive: true });
  await panel.screenshot({
    path: '/tmp/mm-series-screenshots/seasons-dark.png',
    animations: 'disabled',
  });
  for (const width of [320, 360, 390, 600, 760, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Page overflow ${width}`,
    );
    await page.waitForFunction(() => {
      const el = document.querySelector('.series-panel');
      return el && el.scrollWidth <= el.clientWidth + 1;
    });
    assert(
      await panel.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      `Panel overflow ${width}`,
    );
    assert(
      await panel
        .locator('.series-season-choices')
        .evaluate((el) => el.clientWidth > 0),
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await panel
    .getByRole('button', { name: 'Сезон 1 3 эп.', exact: true })
    .click();
  await expectSeason(1);
  await panel.screenshot({
    path: '/tmp/mm-series-screenshots/seasons-mobile.png',
    animations: 'disabled',
  });
  await chooseTheme(page, 'Светлая');
  await panel.screenshot({
    path: '/tmp/mm-series-screenshots/seasons-light-mobile.png',
    animations: 'disabled',
  });
  // Native buttons are keyboard-operable. Ctrl/clipboard permissions are not required.
  const second = panel.getByRole('button', {
    name: 'Сезон 2 3 эп.',
    exact: true,
  });
  await second.focus();
  await page.keyboard.press('Enter');
  await expectSeason(2);
  assert.equal(await second.getAttribute('aria-pressed'), 'true');
  await page
    .getByRole('navigation', { name: 'Мобильная навигация', exact: true })
    .getByRole('link', { name: 'Каталог', exact: true })
    .click();
  await page.waitForURL('**/catalog');
  await page.goBack();
  await expectSeason(2);
  await page.goto(base + '/movie/' + manyId);
  await panel
    .getByRole('combobox', { name: 'Выбрать сезон', exact: true })
    .waitFor();
  assert.equal(await panel.locator('.series-season-choices').count(), 0);
  await panel
    .getByRole('combobox', { name: 'Выбрать сезон', exact: true })
    .selectOption({ label: 'Сезон 8 · История 8 · 3 эп.' });
  await expectSeason(8);
  await panel.screenshot({
    path: '/tmp/mm-series-screenshots/seasons-many.png',
    animations: 'disabled',
  });
  await page.goto(base + '/movie/' + singleId);
  await expectSeason(1);
  assert.equal(
    await panel
      .getByRole('navigation', { name: 'Выбор сезона', exact: true })
      .count(),
    0,
  );
  assert.equal(
    await panel
      .getByRole('navigation', { name: 'Переход между сезонами', exact: true })
      .count(),
    0,
  );
  await page.goto(base + '/movie/' + emptyId);
  await panel
    .getByText('Сезоны ещё не добавлены редактором.', { exact: false })
    .waitFor();
  assert.equal(await season.count(), 0);
  // Editor remains usable, with draft protection and graceful deletion of an active season.
  await db.query("update mg_users set role='admin' where id=$1", [userId]);
  await page.goto(url + '?season=2');
  await expectSeason(2);
  await panel
    .getByRole('button', { name: 'Редактировать сезоны', exact: true })
    .click();
  await season
    .getByLabel('Название (необязательно)', { exact: true })
    .fill('Черновик сезона');
  page.once('dialog', (d) => d.dismiss());
  await panel
    .getByRole('button', { name: 'Сезон 1 3 эп.', exact: true })
    .click();
  await expectSeason(2);
  assert.equal(
    await season
      .getByLabel('Название (необязательно)', { exact: true })
      .inputValue(),
    'Черновик сезона',
  );
  page.once('dialog', (d) => d.accept());
  await panel
    .getByRole('button', { name: 'Сезон 1 3 эп.', exact: true })
    .click();
  await expectSeason(1);
  await season
    .getByLabel('Название (необязательно)', { exact: true })
    .fill('Новое название');
  await season
    .getByRole('button', { name: 'Сохранить сезон', exact: true })
    .click();
  await season
    .getByRole('heading', { name: 'Сезон 1 · Новое название', exact: true })
    .waitFor();
  page.once('dialog', (d) => d.accept());
  await season
    .getByRole('button', { name: 'Удалить сезон', exact: true })
    .click();
  await expectSeason(2);
  await panel
    .getByText('Сезон из ссылки недоступен.', { exact: false })
    .waitFor();
  assert.equal(
    await panel
      .getByRole('button', { name: 'Сезон 1 3 эп.', exact: true })
      .count(),
    0,
  );
  const newEditor = panel.locator('.series-editor');
  await newEditor.getByLabel('Эпизодов', { exact: true }).fill('3');
  await newEditor
    .getByRole('button', { name: 'Добавить сезон', exact: true })
    .click();
  await panel
    .getByRole('button', { name: 'Сезон 5 3 эп.', exact: true })
    .waitFor();
  await panel
    .getByRole('button', { name: 'Сезон 5 3 эп.', exact: true })
    .click();
  await expectSeason(5);
  // Fresh guest has no account preference and gets auth gating, not rating controls.
  const guest = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    }),
    gp = await guest.newPage();
  gp.on('pageerror', (e) => errors.push(e.message));
  await gp.goto(url);
  const guestPanel = gp.getByRole('region', {
    name: 'Сезоны и эпизоды',
    exact: true,
  });
  await guestPanel.locator('.series-season h4').waitFor();
  assert(
    (await guestPanel.locator('.series-season h4').innerText()).startsWith(
      'Сезон 2',
    ),
  );
  assert.equal(await guestPanel.locator('.series-season select').count(), 0);
  await guestPanel
    .getByRole('button', { name: 'Сезон 4 3 эп.', exact: true })
    .click();
  await guestPanel
    .locator('.series-season')
    .getByRole('button', { name: 'Войти для оценки', exact: true })
    .first()
    .click();
  await gp.locator('.auth-modal').waitFor();
  await guest.close();
  // A blocked localStorage still permits navigation and URL persistence.
  const restricted = await browser.newContext({
    viewport: { width: 320, height: 844 },
    reducedMotion: 'reduce',
  });
  await restricted.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException('Disabled', 'SecurityError');
    };
    Storage.prototype.setItem = () => {
      throw new DOMException('Disabled', 'SecurityError');
    };
  });
  const rp = await restricted.newPage();
  rp.on('pageerror', (e) => errors.push(e.message));
  await rp.goto(url + '?season=4');
  const restrictedPanel = rp.locator('.series-panel');
  await restrictedPanel
    .getByRole('button', { name: 'Сезон 5 3 эп.', exact: true })
    .click();
  await restrictedPanel
    .locator('.series-season')
    .getByRole('heading', { name: 'Сезон 5', exact: true })
    .waitFor();
  await rp.reload();
  await restrictedPanel
    .locator('.series-season')
    .getByRole('heading', { name: 'Сезон 5', exact: true })
    .waitFor();
  await restricted.close();
  assert.deepEqual(errors, []);
  console.log(
    'Passed production season navigation: one mounted season, sparse prev/next + focus, remembered/account-isolated/direct URL selection, no navigation fetches, real ratings/no XP/failure, clipboard fallback, keyboard, 8 widths/dark/light, many/single/empty, editor save/add/delete/draft protection, guest gate and restricted storage. Screenshots /tmp/mm-series-screenshots',
  );
} finally {
  if (ids.length)
    await db.query('delete from mg_movies where id=any($1::int[])', [ids]);
  if (userId) {
    await db.query('delete from mg_admin_audit where actor_id=$1', [userId]);
    await db.query('delete from mg_users where id=$1', [userId]);
  }
  await browser.close();
  await db.end();
}
