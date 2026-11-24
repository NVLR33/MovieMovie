// Production catalog facets and controls; SQL fixtures are restricted to marker-guarded localhost.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { Client } from 'pg';
import {
  chooseTheme,
  openSettings,
  closeSettings,
} from './settings-controls.mjs';
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
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'reduce',
  });
  await context.addInitScript(() => {
    localStorage.setItem('mg_season_mode', 'off');
  });
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /hydration|Minified React error/i.test(message.text())
    )
      errors.push(message.text());
  });
  const stamp = Date.now(),
    studio = 'DiscoveryFixture' + stamp,
    signup = await context.request.post(base + '/api/auth', {
      data: {
        action: 'register',
        email: `discovery-${stamp}@example.test`,
        username: `Discovery${stamp}`,
        password: 'discovery-isolated-browser-password',
      },
    });
  assert.equal(signup.status(), 200);
  userId = (await signup.json()).user.id;
  const defs = [
    ['Драма', 'Фильм', 'Драма, ДРАМА, Детектив', 1959, 9, 'tears'],
    ['Комедия', 'Сериал', 'Комедия, Драма', 2020, 8, 'popcorn'],
    ['Аниме-сериал', 'Аниме-сериал', 'Фэнтези, Приключения', 2022, 7, 'cozy'],
    ['Аниме-фильм', 'Аниме-фильм', 'Фантастика, Приключения', 2023, 6, 'mind'],
    ['Триллер', 'Фильм', 'Триллер, Боевик', 2024, 5, 'grip'],
    ['Мелодрама', 'Фильм', 'Мелодрама', 2020, 4, 'night'],
    ['Исторический', 'Сериал', 'Исторический', 2024, 3, 'cozy'],
  ];
  for (const [label, category, genre, year, views, mood] of defs) {
    const id = (
      await db.query(
        "insert into mg_movies(title,description,category,genre,studio,year,duration,poster,views,mood)values($1,'Catalog discovery fixture',$2,$3,$4,$5,90,'/brand/moviemovie-logo.png',$6,$7)returning id",
        ['Плитка ' + label, category, genre, studio, year, views, mood],
      )
    ).rows[0].id;
    ids.push(id);
    await db.query(
      'insert into mg_ratings(user_id,movie_id,value)values($1,$2,$3)',
      [userId, id, views],
    );
  }
  await db.query('insert into mg_watches(user_id,movie_id)values($1,$2)', [
    userId,
    ids[0],
  ]);
  const fixtureUrl = base + '/catalog?studio=' + studio,
    genreGroup = page.getByRole('group', {
      name: 'Быстрый выбор жанра',
      exact: true,
    }),
    formats = page.getByRole('group', { name: 'Тип материала', exact: true }),
    panel = page.locator('#catalog-precise-filters'),
    chips = page.getByRole('group', { name: 'Выбранные фильтры', exact: true });
  async function titles() {
    return (
      await page.locator('.film-grid > .film-card h3').allTextContents()
    ).sort();
  }
  async function expectTitles(expected) {
    await page.waitForFunction(
      (n) => document.querySelectorAll('.film-grid > .film-card').length === n,
      expected.length,
    );
    assert.deepEqual(await titles(), expected.map((s) => 'Плитка ' + s).sort());
  }
  async function count(genre) {
    return Number(
      await genreGroup
        .getByRole('button', { name: 'Жанр: ' + genre, exact: true })
        .locator('.catalog-genre-tile-top > small')
        .innerText()
        .then((s) => s.match(/^\d+/)?.[0]),
    );
  }
  async function load(url = fixtureUrl) {
    await page.goto(url);
    await page.locator('.hud-xp-chip').waitFor();
    await genreGroup.waitFor();
    await page.waitForFunction(
      () => document.documentElement.dataset.season === 'off',
    );
    await page.evaluate(() => document.fonts.ready);
  }
  await load(base + '/catalog');
  assert.equal(await panel.isVisible(), false);
  assert.equal(
    await page
      .getByRole('combobox', { name: 'Сортировка', exact: true })
      .isVisible(),
    true,
  );
  await load();
  await expectTitles(defs.map((d) => d[0]));
  assert.equal(await count('Все жанры'), 7);
  assert.equal(await count('Драма'), 2);
  assert.equal(await count('Комедия'), 1);
  await genreGroup
    .getByRole('button', { name: 'Жанр: Драма', exact: true })
    .click();
  await expectTitles(['Драма', 'Комедия']);
  assert.equal(
    await page
      .getByRole('combobox', { name: 'Жанр', exact: true })
      .inputValue(),
    'Драма',
  );
  assert.equal(
    await count('Комедия'),
    1,
    'Alternative genre counts ignore selected genre',
  );
  assert.equal(await count('Все жанры'), 7);
  await chips
    .getByRole('button', { name: 'Снять фильтр: Жанр — Драма', exact: true })
    .waitFor();
  await genreGroup
    .getByRole('button', { name: 'Жанр: Драма', exact: true })
    .click();
  await expectTitles(defs.map((d) => d[0]));
  assert.equal(
    await page
      .getByRole('combobox', { name: 'Студия', exact: true })
      .inputValue(),
    studio,
    'Toggle preserves unrelated filters',
  );
  await page
    .getByRole('combobox', { name: 'Жанр', exact: true })
    .selectOption('Триллер');
  await expectTitles(['Триллер']);
  assert.equal(
    await genreGroup
      .getByRole('button', { name: 'Жанр: Триллер', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  );
  await chips
    .getByRole('button', { name: 'Снять фильтр: Жанр — Триллер', exact: true })
    .click();
  await expectTitles(defs.map((d) => d[0]));
  await formats
    .getByRole('button', { name: 'Аниме-сериалы', exact: true })
    .click();
  await expectTitles(['Аниме-сериал']);
  assert.equal(await count('Приключения'), 1);
  assert.equal(await count('Драма'), 0);
  await formats
    .getByRole('button', { name: 'Аниме-фильмы', exact: true })
    .click();
  await expectTitles(['Аниме-фильм']);
  await chips
    .getByRole('button', {
      name: 'Снять фильтр: Тип — Аниме-фильмы',
      exact: true,
    })
    .click();
  await page
    .getByRole('combobox', { name: 'Год', exact: true })
    .selectOption('before1960');
  assert.equal(await count('Драма'), 1);
  await genreGroup
    .getByRole('button', { name: 'Жанр: Драма', exact: true })
    .click();
  await expectTitles(['Драма']);
  await chips
    .getByRole('button', { name: 'Снять фильтр: Год — До 1960', exact: true })
    .click();
  await expectTitles(['Драма', 'Комедия']);
  await page.getByRole('button', { name: '😭 Поплакать', exact: true }).click();
  await expectTitles(['Драма']);
  assert.equal(await count('Комедия'), 0);
  await page.getByRole('button', { name: '😭 Поплакать', exact: true }).click();
  await expectTitles(['Драма', 'Комедия']);
  await page
    .getByRole('combobox', { name: 'Статус просмотра', exact: true })
    .selectOption('watched');
  await expectTitles(['Драма']);
  assert.equal(await count('Комедия'), 0);
  await chips
    .getByRole('button', {
      name: 'Снять фильтр: Просмотр — Просмотренные',
      exact: true,
    })
    .click();
  await page
    .getByRole('combobox', { name: 'Минимальный рейтинг', exact: true })
    .selectOption('9');
  await expectTitles(['Драма']);
  await chips
    .getByRole('button', { name: 'Снять фильтр: Рейтинг — 9+', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Поиск в каталоге', exact: true })
    .fill('Комедия');
  await expectTitles(['Комедия']);
  assert.equal(await count('Все жанры'), 1);
  await page
    .getByRole('button', { name: 'Очистить поиск в каталоге', exact: true })
    .click();
  await expectTitles(['Драма', 'Комедия']);
  await chips
    .getByRole('button', { name: 'Снять фильтр: Жанр — Драма', exact: true })
    .click();
  await page
    .getByRole('combobox', { name: 'Жанр', exact: true })
    .selectOption('Исторический');
  await expectTitles(['Исторический']);
  assert.equal(
    await genreGroup
      .getByRole('button', { name: 'Жанр: Исторический', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  );
  await chips
    .getByRole('button', {
      name: 'Снять фильтр: Жанр — Исторический',
      exact: true,
    })
    .click();
  assert.equal(
    await genreGroup
      .getByRole('button', { name: 'Жанр: Исторический', exact: true })
      .count(),
    0,
  );
  // Zero facets stay operable and recover by removing the single conflicting condition.
  await page
    .getByRole('combobox', { name: 'Год', exact: true })
    .selectOption('before1960');
  await genreGroup
    .getByRole('button', { name: 'Жанр: Боевик', exact: true })
    .click();
  await page
    .getByRole('heading', { name: 'Пока ничего не найдено', exact: true })
    .waitFor();
  await chips
    .getByRole('button', { name: 'Снять фильтр: Жанр — Боевик', exact: true })
    .click();
  await expectTitles(['Драма']);
  await page.getByRole('button', { name: 'Все фильтры', exact: true }).click();
  assert.equal(await panel.isVisible(), false);
  assert.equal(await chips.isVisible(), true);
  await chips
    .getByRole('button', { name: 'Снять фильтр: Год — До 1960', exact: true })
    .click();
  await expectTitles(defs.map((d) => d[0]));
  await page
    .getByRole('combobox', { name: 'Сортировка', exact: true })
    .selectOption('old');
  assert.equal(
    (await page.locator('.film-grid h3').allTextContents())[0],
    'Плитка Драма',
  );
  await chips
    .getByRole('button', {
      name: 'Снять фильтр: Порядок — Сначала старые',
      exact: true,
    })
    .click();
  assert.equal(
    await page
      .getByRole('combobox', { name: 'Сортировка', exact: true })
      .inputValue(),
    'popular',
  );
  // Keyboard selection uses standard buttons, and the rail stays within page bounds.
  const comedy = genreGroup.getByRole('button', {
    name: 'Жанр: Комедия',
    exact: true,
  });
  await comedy.focus();
  await page.keyboard.press('Enter');
  await expectTitles(['Комедия']);
  await page.keyboard.press('Enter');
  await expectTitles(defs.map((d) => d[0]));
  fs.mkdirSync('/tmp/mm-catalog-screenshots', { recursive: true });
  await chooseTheme(page, 'Тёмная');
  const capture = {
    animations: 'disabled',
    style: '.topbar,.mobile-bottom-nav{visibility:hidden!important;}',
  };
  await page.locator('.catalog-discovery').screenshot({
    path: '/tmp/mm-catalog-screenshots/catalog-dark.png',
    ...capture,
  });
  for (const width of [320, 360, 390, 600, 760, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForFunction(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    );
    assert(
      await page
        .locator('.catalog-discovery')
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      `Discovery overflow ${width}`,
    );
    await page
      .getByRole('button', { name: 'Все фильтры', exact: true })
      .click();
    assert(await panel.isVisible());
    assert(
      await panel.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      `Precise overflow ${width}`,
    );
    await page
      .getByRole('button', { name: 'Все фильтры', exact: true })
      .click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator('.catalog-genre-track')
    .evaluate((el) => el.scrollTo({ left: 0, behavior: 'instant' }));
  await page
    .getByRole('button', { name: 'Следующие жанры', exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelector('.catalog-genre-track').scrollLeft > 0,
  );
  await page
    .getByRole('button', { name: 'Предыдущие жанры', exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelector('.catalog-genre-track').scrollLeft <= 2,
  );
  await page.locator('.catalog-discovery').screenshot({
    path: '/tmp/mm-catalog-screenshots/catalog-mobile.png',
    ...capture,
  });
  await chooseTheme(page, 'Светлая');
  await page.locator('.catalog-discovery').screenshot({
    path: '/tmp/mm-catalog-screenshots/catalog-light-mobile.png',
    ...capture,
  });
  await page.getByRole('button', { name: 'Все фильтры', exact: true }).click();
  await panel.screenshot({
    path: '/tmp/mm-catalog-screenshots/catalog-precise-mobile.png',
    ...capture,
  });
  await page
    .getByRole('textbox', { name: 'Поиск в каталоге', exact: true })
    .fill('a'.repeat(180));
  assert(await chips.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
  await page
    .getByRole('button', { name: 'Сбросить фильтры', exact: true })
    .click();
  assert.equal(await chips.count(), 0);
  assert.equal(
    await page
      .getByRole('textbox', { name: 'Поиск в каталоге', exact: true })
      .inputValue(),
    '',
  );
  assert.equal(
    await page
      .getByRole('combobox', { name: 'Студия', exact: true })
      .inputValue(),
    'Все студии',
  );
  // Existing collection/deep links retain exact state and counts after reload.
  await load(
    fixtureUrl +
      '&genre=' +
      encodeURIComponent('Драма') +
      '&category=' +
      encodeURIComponent('Фильм') +
      '&year=before1960&minRating=8&watch=watched&sort=rating',
  );
  await expectTitles(['Драма']);
  assert.equal(await count('Драма'), 1);
  await page.reload();
  await page.locator('.hud-xp-chip').waitFor();
  await expectTitles(['Драма']);
  assert.equal(
    await genreGroup
      .getByRole('button', { name: 'Жанр: Драма', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  );
  const settings = await openSettings(page);
  await settings.getByRole('radio', { name: 'English', exact: true }).check();
  await settings.getByText('Settings applied.', { exact: true }).waitFor();
  await closeSettings(page);
  await page
    .getByRole('group', { name: 'Quick genre selection', exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole('combobox', { name: 'Sort order', exact: true })
      .inputValue(),
    'rating',
  );
  assert.equal(
    await page
      .getByRole('button', { name: 'Genre: Drama', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  );
  const guest = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    }),
    gp = await guest.newPage();
  gp.on('pageerror', (e) => errors.push(e.message));
  await gp.goto(fixtureUrl);
  await gp.getByRole('button', { name: 'Жанр: Драма', exact: true }).click();
  await gp.waitForFunction(
    () => document.querySelectorAll('.film-grid > .film-card').length === 2,
  );
  assert.equal(await gp.locator('.auth-modal').count(), 0);
  await guest.close();
  assert.deepEqual(errors, []);
  console.log(
    'Passed production catalog discovery: exact/contextual/deduplicated counts, synchronized tile/select/chips, anime formats, intersections/query/mood/rating/watch, custom and zero genres, individual/full reset, visible sort, keyboard/rail controls, deep links/reload, 8 widths/light/dark/EN, guest access and no runtime/hydration errors. Screenshots /tmp/mm-catalog-screenshots',
  );
} finally {
  if (ids.length) {
    await db.query('delete from mg_ratings where movie_id=any($1::int[])', [
      ids,
    ]);
    await db.query('delete from mg_watches where movie_id=any($1::int[])', [
      ids,
    ]);
    await db.query('delete from mg_movies where id=any($1::int[])', [ids]);
  }
  if (userId) await db.query('delete from mg_users where id=$1', [userId]);
  await browser.close();
  await db.end();
}
