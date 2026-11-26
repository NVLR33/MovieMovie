// Production build; optional browser tools and marker-guarded disposable SQL only.
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
    (a) => !['--single-process', '--disable-web-security'].includes(a),
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
    errors = [],
    external = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== new URL(base).origin)
      external.push(request.url());
  });
  await context.addInitScript(() => {
    localStorage.setItem('mg_season_mode', 'off');
    window.geoCalls = 0;
    window.geoDeny = false;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(ok, fail) {
          window.geoCalls++;
          if (window.geoDeny) fail({ code: 1 });
          else
            ok({
              coords: { latitude: 56.4149, longitude: 61.9187, accuracy: 50 },
            });
        },
      },
    });
  });
  const stamp = Date.now(),
    studio = 'CitySeries' + stamp;
  const signup = await context.request.post(base + '/api/auth', {
    data: {
      action: 'register',
      email: `cityseries-${stamp}@example.test`,
      username: 'City' + stamp,
      password: 'city-series-browser-password',
    },
  });
  assert.equal(signup.status(), 200);
  userId = (await signup.json()).user.id;
  for (const category of ['Сериал', 'Фильм']) {
    const id = (
      await db.query(
        "insert into mg_movies(title,description,category,genre,studio,year,duration,episodes,poster,age_rating)values($1,'Fixture',$2,'Драма',$3,2024,48,100,'/brand/moviemovie-logo.png','16+')returning id",
        ['Издание ' + category, category, studio],
      )
    ).rows[0].id;
    ids.push(id);
    await db.query(
      'insert into mg_ratings(user_id,movie_id,value)values($1,$2,9)',
      [userId, id],
    );
    await db.query('insert into mg_watches(user_id,movie_id)values($1,$2)', [
      userId,
      id,
    ]);
  }
  await db.query(
    "insert into mg_series_seasons(movie_id,number,title)values($1,1,'Первый'),($1,2,'Второй')",
    [ids[0]],
  );
  fs.mkdirSync('/tmp/mm-city-series-screenshots', { recursive: true });
  const open = async (path) => {
    await page.goto(base + path);
  };
  await open('/catalog?studio=' + studio);
  await page.locator('.film-card').last().waitFor();
  const serial = page
      .locator('.film-card')
      .filter({ hasText: 'Издание Сериал' }),
    film = page.locator('.film-card').filter({ hasText: 'Издание Фильм' });
  assert.equal(await serial.locator('[data-series=true]').count(), 1);
  assert.equal(await film.locator('[data-series=true]').count(), 0);
  assert.equal(
    await serial.locator('.series-poster-caption').innerText(),
    '2 сез. · 100 сер.',
  );
  const data = await (await context.request.get(base + '/api/data')).json();
  assert.equal(data.films.find((f) => f.id === ids[0]).seasonCount, 2);
  for (const theme of ['Тёмная', 'Светлая']) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await chooseTheme(page, theme);
    for (const width of [320, 390, 768, 1182, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const mode of [0, 1, 2]) {
        await page.locator('.material-view-control button').nth(mode).click();
        const issues = await serial.evaluate((el) => {
          const entries = [
              ...el.querySelectorAll(
                '.card-score,.card-favorite-btn,.card-age-rating,.card-watched-badge,.series-poster-caption',
              ),
            ].map((node) => ({
              name: node.className,
              r: node.getBoundingClientRect(),
            })),
            p = el.querySelector('.poster-wrap').getBoundingClientRect(),
            issues = [];
          for (const { name, r } of entries) {
            if (
              r.left < p.left - 1 ||
              r.right > p.right + 1 ||
              r.top < p.top - 1 ||
              r.bottom > p.bottom + 1
            )
              issues.push('outside ' + name);
          }
          for (let a = 0; a < entries.length; a++)
            for (let b = a + 1; b < entries.length; b++) {
              const x = entries[a],
                y = entries[b];
              if (
                x.r.left < y.r.right &&
                x.r.right > y.r.left &&
                x.r.top < y.r.bottom &&
                x.r.bottom > y.r.top
              )
                issues.push('overlap ' + x.name + ' / ' + y.name);
            }
          if (document.documentElement.scrollWidth > innerWidth + 1)
            issues.push('page overflow');
          return issues;
        });
        assert.deepEqual(issues, [], `${theme}/${width}/view${mode}`);
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.material-view-control button').first().click();
  await serial.screenshot({
    path: '/tmp/mm-city-series-screenshots/series-card.png',
  });
  // No mount-time location prompt; manual cities work without coordinates.
  assert.equal(await page.evaluate(() => window.geoCalls), 0);
  const panel = page.locator('.city-cinema');
  await panel.locator('summary').click();
  await panel.getByLabel('Город', { exact: true }).fill('Москва');
  await panel.getByRole('button', { name: 'Применить', exact: true }).click();
  assert.match(await panel.locator('summary').innerText(), /Москва/);
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('mg_city_v1')).city,
    ),
    '',
  );
  await page.reload();
  await panel.locator('summary').click();
  assert.doesNotMatch(await panel.locator('summary').innerText(), /Москва/);
  await panel.getByLabel('Город', { exact: true }).fill('Москва');
  await panel.getByLabel(/Запомнить на этом устройстве/).check();
  await panel.getByRole('button', { name: 'Применить', exact: true }).click();
  await page.reload();
  await panel.locator('summary').click();
  assert.match(await panel.locator('summary').innerText(), /Москва/);
  assert.equal(await page.evaluate(() => window.geoCalls), 0);
  await panel
    .getByRole('button', { name: 'Определить местоположение', exact: true })
    .click();
  assert.equal(
    await panel.getByLabel('Город', { exact: true }).inputValue(),
    'Каменск-Уральский',
  );
  assert.match(
    await panel.locator('summary').innerText(),
    /Москва/,
    'coordinates are a suggestion, not consent to save',
  );
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('mg_city_v1')).city,
    ),
    'Москва',
  );
  assert.equal(await page.evaluate(() => window.geoCalls), 1);
  await panel.getByRole('button', { name: 'Применить', exact: true }).click();
  const link = panel.getByRole('link', { name: /Найти сеансы/ }),
    url = new URL(await link.getAttribute('href'));
  assert.equal(url.origin, 'https://yandex.ru');
  assert.match(url.searchParams.get('text'), /Каменск-Уральский/);
  assert.deepEqual(
    await page.evaluate(() =>
      Object.keys(JSON.parse(localStorage.getItem('mg_city_v1'))),
    ),
    ['city'],
  );
  await page.evaluate(() => {
    window.geoDeny = true;
  });
  await panel
    .getByRole('button', { name: 'Определить местоположение', exact: true })
    .click();
  await panel.getByText(/Доступ к геолокации запрещён/).waitFor();
  await panel.screenshot({
    path: '/tmp/mm-city-series-screenshots/city-choice-mobile.png',
  });
  const settings = await openSettings(page);
  await settings.getByRole('heading', { name: 'Город и кинотеатры' }).waitFor();
  await closeSettings(page);
  await open('/movie/' + ids[1]);
  await page.getByRole('link', { name: /Искать сеансы/ }).waitFor();
  await open('/movie/' + ids[0]);
  await page.locator('.detail-series-cover[data-series=true]').waitFor();
  assert.equal(
    await page.getByRole('link', { name: /Искать сеансы/ }).count(),
    0,
  );
  // The own-profile tab ring must remain inside its scroll/paint ancestors on hover/focus.
  await open('/profile');
  await page.locator('.stats-tabs').waitFor();
  for (const width of [320, 390, 768, 1182, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const button of await page.locator('.stats-tabs button').all()) {
      await button.hover();
      await button.focus();
      const clipped = await button.evaluate((el) => {
        const r = el.getBoundingClientRect();
        let p = el.parentElement;
        while (p) {
          const s = getComputedStyle(p),
            b = p.getBoundingClientRect();
          if (
            /hidden|auto|scroll|clip/.test(s.overflowX + ' ' + s.overflowY) &&
            (r.top - 2 < b.top ||
              r.bottom + 2 > b.bottom ||
              r.left - 2 < b.left ||
              r.right + 2 > b.right)
          )
            return true;
          p = p.parentElement;
        }
        return false;
      });
      assert(!clipped, `Clipped hover ring at ${width}`);
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(
    external,
    [],
    'No maps, reverse geocoder or schedule request without deliberate outbound navigation',
  );
  console.log(
    'Passed series editions/city/privacy/profile hover: real season counts, no stack on films, badge isolation in 3 views/5 widths/2 themes, explicit location only, manual/session/remembered city, offline GPS suggestion confirmation, denied-permission fallback, safe outbound cinema search, settings and detail links, unclipped profile tab rings. Screenshots /tmp/mm-city-series-screenshots',
  );
} finally {
  await browser.close();
  if (ids.length) {
    for (const table of ['mg_ratings', 'mg_watches'])
      await db.query(`delete from ${table} where movie_id=any($1::int[])`, [
        ids,
      ]);
    await db.query('delete from mg_movies where id=any($1::int[])', [ids]);
  }
  if (userId) await db.query('delete from mg_users where id=$1', [userId]);
  await db.end();
}
