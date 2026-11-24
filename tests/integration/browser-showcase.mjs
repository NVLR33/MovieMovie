import { chooseTheme } from './settings-controls.mjs';
// Production collections UI, disposable local SQL with mandatory fixture marker only.
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
      viewport: { width: 1440, height: 1050 },
      reducedMotion: 'reduce',
    }),
    page = await context.newPage(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const signup = await context.request.post(base + '/api/auth', {
    data: {
      action: 'register',
      email: `showcase-${Date.now()}@example.test`,
      username: `Showcase${Date.now()}`,
      password: 'showcase-isolated-browser-password',
    },
  });
  assert.equal(signup.status(), 200);
  userId = (await signup.json()).user.id;
  for (let i = 0; i < 26; i++) {
    const id = (
      await db.query(
        "insert into mg_movies(title,description,category,genre,studio,\"cast\",year,duration,poster,backdrop)values($1,'Collection local fixture','Фильм','Тестовый жанр',$2,$3,2024,90,'/brand/moviemovie-logo.png',$4)returning id",
        [
          `Кинооткрытие ${i + 1}`,
          i === 25 ? 'Showcase Studios, Showcase Annex' : 'Showcase Studios',
          i === 25 ? 'Мария Тестовая; Алексей Примеров' : 'Мария Тестовая',
          i === 0 ? '/brand/moviemovie-logo.png' : null,
        ],
      )
    ).rows[0].id;
    ids.push(id);
  }
  await db.query(
    'insert into mg_watches(user_id,movie_id,watched_at)values($1,$2,now())',
    [userId, ids[25]],
  );
  await page.goto(base + '/collab');
  const showcase = page.locator('.collection-showcase');
  await showcase.waitFor();
  await page.waitForFunction(
    () => document.querySelectorAll('.collection-shelf').length > 0,
  );
  assert((await showcase.locator('.collection-shelf').count()) <= 6);
  await showcase.getByRole('link', { name: /^Студии/ }).click();
  await page.waitForURL('**/collab?view=studio');
  await showcase
    .getByRole('textbox', { name: 'Поиск подборок', exact: true })
    .fill('Showcase Studios');
  const shelf = page.getByRole('region', {
    name: 'Студия: Showcase Studios',
    exact: true,
  });
  await shelf.waitFor();
  assert.equal(await shelf.locator('.showcase-film').count(), 8);
  await shelf.getByText('Просмотрено 1 из 26', { exact: true }).waitFor();
  fs.mkdirSync('/tmp/mm-showcase-screenshots', { recursive: true });
  await shelf.screenshot({
    path: '/tmp/mm-showcase-screenshots/studio-desktop.png',
    animations: 'disabled',
  });
  for (const width of [320, 360, 390, 600, 760, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 950 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Shelf overflow at ${width}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await shelf
    .getByRole('button', { name: 'Вперёд: Showcase Studios', exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelector('.showcase-poster-strip').scrollLeft > 0,
  );
  await page.screenshot({
    path: '/tmp/mm-showcase-screenshots/studio-mobile.png',
  });
  await shelf.getByRole('link', { name: 'Смотреть все', exact: true }).click();
  await page.waitForURL('**/collab?view=studio&collection=*');
  const detail = page.getByRole('region', {
    name: 'Студия: Showcase Studios',
    exact: true,
  });
  assert.equal(await detail.locator('.showcase-film').count(), 24);
  await detail
    .getByRole('button', { name: 'Показать ещё', exact: true })
    .click();
  assert.equal(await detail.locator('.showcase-film').count(), 26);
  assert.equal(
    await detail.getByRole('status').innerText(),
    'Показано 26 из 26',
  );
  for (const width of [320, 390, 760, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Detail overflow at ${width}`,
    );
  }
  const deepLink = page.url();
  await page.reload();
  await detail.waitFor();
  assert.equal(await detail.locator('.showcase-film').count(), 24);
  await page.getByRole('link', { name: 'Все подборки', exact: true }).click();
  await showcase.getByRole('link', { name: /^Актёры/ }).click();
  await showcase
    .getByRole('textbox', { name: 'Поиск подборок', exact: true })
    .fill('Мария');
  const actor = page.getByRole('region', {
    name: 'Актёр: Мария Тестовая',
    exact: true,
  });
  await actor.waitFor();
  assert.match(await actor.innerText(), /Материалов: 26/);
  await showcase.getByRole('link', { name: /^Жанры/ }).click();
  await showcase
    .getByRole('textbox', { name: 'Поиск подборок', exact: true })
    .fill('Тестовый жанр');
  await page
    .getByRole('region', { name: 'Жанр: Тестовый жанр', exact: true })
    .waitFor();
  await showcase
    .getByRole('textbox', { name: 'Поиск подборок', exact: true })
    .fill('точно несуществующая подборка');
  await showcase
    .getByRole('heading', { name: 'Ничего не нашлось', exact: true })
    .waitFor();
  await showcase
    .getByRole('button', { name: 'Сбросить поиск', exact: true })
    .click();
  assert((await showcase.locator('.collection-shelf').count()) > 0);
  // Existing collaborative creation remains usable; failed requests must retain the draft.
  await showcase.getByRole('link', { name: 'Совместные', exact: true }).click();
  const input = page.getByRole('textbox', {
    name: 'Название совместной подборки',
    exact: true,
  });
  await input.fill('Вечер друзей — проверка');
  await context.route('**/api/action', async (route) => {
    if (route.request().postDataJSON()?.action === 'createList')
      return route.fulfill({ status: 500, json: { error: 'Тестовый отказ' } });
    await route.continue();
  });
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  await page.waitForFunction(
    () => !document.querySelector('.collab-create input').disabled,
  );
  assert.equal(await input.inputValue(), 'Вечер друзей — проверка');
  await context.unroute('**/api/action');
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Вечер друзей — проверка', exact: true })
    .waitFor();
  assert.equal(await input.inputValue(), '');
  await page
    .getByRole('textbox', {
      name: 'Поиск материала: Вечер друзей — проверка',
      exact: true,
    })
    .fill('Кинооткрытие 1');
  await page
    .getByRole('combobox', {
      name: 'Материал для подборки: Вечер друзей — проверка',
      exact: true,
    })
    .selectOption(String(ids[0]));
  await page
    .getByRole('button', { name: 'Добавить в подборку', exact: true })
    .click();
  const vote = page.getByRole('button', {
    name: 'Голос за Кинооткрытие 1: 0',
    exact: true,
  });
  await vote.click();
  await page
    .getByRole('button', { name: 'Голос за Кинооткрытие 1: 1', exact: true })
    .waitFor();
  await page.goto(deepLink);
  await detail.locator('.showcase-film').first().click();
  await page.waitForURL('**/movie/*');
  await page.goto(base + '/collab?view=studio');
  await showcase
    .getByRole('textbox', { name: 'Поиск подборок', exact: true })
    .fill('Showcase Studios');
  await shelf.waitFor();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.evaluate(() => scrollTo(0, 0));
  await chooseTheme(page, 'Светлая');
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === 'light',
  );
  await page.locator('.hud-xp-chip').focus();
  await shelf.screenshot({
    path: '/tmp/mm-showcase-screenshots/studio-light.png',
    animations: 'disabled',
  });
  const guest = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    }),
    guestPage = await guest.newPage();
  guestPage.on('pageerror', (error) => errors.push(error.message));
  await guestPage.goto(deepLink);
  await guestPage
    .getByRole('heading', { name: 'Showcase Studios', exact: true })
    .waitFor();
  assert.equal(
    await guestPage.getByText('Просмотрено 1 из 26', { exact: true }).count(),
    0,
  );
  await guestPage.locator('.showcase-film').first().focus();
  await guestPage.keyboard.press('Enter');
  await guestPage.waitForURL('**/movie/*');
  await guestPage.goto(base + '/collab?view=personal');
  await guestPage
    .getByRole('heading', { name: 'Совместные подборки', exact: true })
    .waitFor();
  assert.equal(
    await guestPage
      .getByRole('textbox', {
        name: 'Название совместной подборки',
        exact: true,
      })
      .count(),
    0,
  );
  await guestPage.goto(base + '/collab?collection=studio%3Aнет-такой');
  await guestPage
    .getByRole('heading', { name: 'Подборка пока недоступна', exact: true })
    .waitFor();
  await guest.route('**/api/data', async (route) => {
    const response = await route.fetch(),
      data = await response.json();
    await route.fulfill({ response, json: { ...data, films: [] } });
  });
  await guestPage.goto(base + '/collab');
  await guestPage
    .getByRole('heading', { name: 'Новые подборки ещё впереди', exact: true })
    .waitFor();
  assert.equal(await guestPage.locator('.collection-shelf').count(), 0);
  await guest.close();
  assert.deepEqual(errors, []);
  console.log(
    'Passed production collection showcases: real studio/cast/genre groups, 8-poster shelf/24-item detail paging, exact deep links, watched count, search/empty/missing collection, swipe arrows, keyboard/material navigation, guest access/auth gate, preserved collaborative creation/failure draft/votes, dark/light, 8 widths. Screenshots /tmp/mm-showcase-screenshots',
  );
} finally {
  await browser.close();
  if (userId) {
    await db.query(
      'delete from mg_collab_items where list_id in(select id from mg_collab_lists where owner_id=$1)',
      [userId],
    );
    await db.query('delete from mg_collab_lists where owner_id=$1', [userId]);
    await db.query(
      'delete from mg_watches where user_id=$1 and movie_id=any($2::int[])',
      [userId, ids],
    );
  }
  if (ids.length)
    await db.query('delete from mg_movies where id=any($1::int[])', [ids]);
  await db.end();
}
