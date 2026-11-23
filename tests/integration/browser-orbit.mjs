// Production spatial diary on a disposable marker-guarded local database.
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
    (a) => !['--single-process', '--disable-web-security'].includes(a),
  ),
  headless: true,
});
const ids = [];
let userId;
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'no-preference',
    }),
    page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const stamp = Date.now(),
    signup = await context.request.post(base + '/api/auth', {
      data: {
        action: 'register',
        email: `orbit-${stamp}@example.test`,
        username: `Orbit${stamp}`,
        password: 'orbit-isolated-browser-password',
      },
    });
  assert.equal(signup.status(), 200);
  userId = (await signup.json()).user.id;
  for (let i = 0; i < 28; i++) {
    const id = (
      await db.query(
        "insert into mg_movies(title,description,category,genre,year,duration,poster,country)values($1,'Orbit local fixture','Фильм','Драма',2024,90,'/brand/moviemovie-logo.png','Россия')returning id",
        [`Орбита ${i}`],
      )
    ).rows[0].id;
    ids.push(id);
    await db.query(
      'insert into mg_watches(user_id,movie_id,watched_at)values($1,$2,$3)',
      [
        userId,
        id,
        i < 26
          ? `2025-11-${String(i + 1).padStart(2, '0')}T12:00:00Z`
          : `2025-10-${i === 26 ? '01' : '02'}T12:00:00Z`,
      ],
    );
    if (i === 25 || i === 24)
      await db.query(
        'insert into mg_ratings(user_id,movie_id,value)values($1,$2,$3)',
        [userId, id, i === 25 ? 10 : 2],
      );
  }
  await db.query(
    'insert into mg_comments(user_id,movie_id,body,spoiler)values($1,$2,$3,true)',
    [userId, ids[25], 'Мой секретный поворот в воспоминании'],
  );
  await page.goto(base + '/profile');
  const orbit = page.getByRole('region', {
    name: 'Орбита воспоминаний',
    exact: true,
  });
  await orbit.waitFor();
  await orbit.scrollIntoViewIfNeeded();
  assert.equal(await orbit.locator('.orbit-card').count(), 24);
  assert.equal(
    await orbit.getByRole('status').innerText(),
    'Показано 24 из 28',
  );
  assert.equal(
    await orbit.locator('.orbit-caption b').first().innerText(),
    'Орбита 25',
  );
  assert.equal(await orbit.locator('.memory-classic').count(), 1);
  assert.equal(await orbit.locator('.memory-muted').count(), 1);
  assert.equal(await orbit.locator('.memory-neutral').count(), 22);
  const classic = orbit.locator('.memory-classic .orbit-card');
  await classic.scrollIntoViewIfNeeded();
  await page.waitForFunction(() =>
    document
      .querySelector('.memory-classic')
      ?.style.getPropertyValue('--orbit-z'),
  );
  const before = await orbit
    .locator('.memory-classic')
    .evaluate((el) => el.style.getPropertyValue('--orbit-z'));
  await page.evaluate(() => scrollBy(0, 180));
  await page.waitForFunction(
    (value) =>
      document
        .querySelector('.memory-classic')
        ?.style.getPropertyValue('--orbit-z') !== value,
    before,
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(
    () =>
      !document.querySelector('.memory-orbit')?.hasAttribute('data-spatial'),
  );
  assert.equal(
    await classic.evaluate((el) => getComputedStyle(el).transform),
    'none',
  );
  const widths = await orbit
    .locator('.memory-classic .orbit-card,.memory-muted .orbit-card')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
  assert(
    widths[0] > widths[1],
    'Personal 10/10 should be physically larger on desktop',
  );
  fs.mkdirSync('/tmp/mm-orbit-screenshots', { recursive: true });
  await classic.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: '/tmp/mm-orbit-screenshots/orbit-desktop.png',
    animations: 'disabled',
  });
  await classic.click();
  const dialog = page.getByRole('dialog', { name: 'Орбита 25', exact: true });
  await dialog.waitFor();
  assert.equal(
    await dialog
      .getByText('Мой секретный поворот в воспоминании', { exact: true })
      .count(),
    0,
  );
  await dialog
    .getByRole('button', {
      name: 'Показать мой отзыв со спойлером',
      exact: true,
    })
    .click();
  await dialog
    .getByText('Мой секретный поворот в воспоминании', { exact: true })
    .waitFor();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    assert(await dialog.evaluate((el) => el.contains(document.activeElement)));
  }
  await page.screenshot({
    path: '/tmp/mm-orbit-screenshots/memory-dialog.png',
  });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  await page.waitForFunction(() =>
    document.activeElement?.classList.contains('orbit-card'),
  );
  await orbit
    .getByRole('button', { name: 'Ещё 4 воспоминаний', exact: true })
    .click();
  assert.equal(await orbit.locator('.orbit-card').count(), 28);
  assert.equal(
    await orbit.getByRole('status').innerText(),
    'Показано 28 из 28',
  );
  await orbit
    .getByRole('combobox', { name: 'Месяц просмотра', exact: true })
    .selectOption('2025-10');
  assert.equal(await orbit.locator('.orbit-card').count(), 2);
  await orbit
    .getByRole('button', { name: 'Личная классика 10/10', exact: true })
    .click();
  await orbit.getByText('На этой орбите пока тихо', { exact: true }).waitFor();
  await orbit
    .getByRole('button', { name: 'Сбросить фильтры истории', exact: true })
    .click();
  assert.equal(await orbit.locator('.orbit-card').count(), 24);
  await orbit
    .getByRole('button', { name: 'Личная классика 10/10', exact: true })
    .click();
  assert.equal(await orbit.locator('.orbit-card').count(), 1);
  await orbit.getByRole('button', { name: 'Список', exact: true }).click();
  assert.equal(
    await page.evaluate(() => localStorage.getItem('mg_memory_view')),
    'list',
  );
  await page.reload();
  await orbit.waitFor();
  await page.waitForFunction(() =>
    document
      .querySelector('.memory-orbit')
      ?.classList.contains('orbit-mode-list'),
  );
  assert.equal(
    await orbit
      .getByRole('button', { name: 'Список', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  );
  await orbit.getByRole('button', { name: 'Лента', exact: true }).click();
  for (const width of [320, 360, 390, 600, 760, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Overflow at ${width}`,
    );
    await classic.click();
    await dialog.waitFor();
    assert(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
  }
  await orbit
    .getByRole('button', { name: 'Личная классика 10/10', exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await classic.click();
  await dialog.waitFor();
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator('.theme-menu').hover();
  await page.getByRole('button', { name: 'Светлая', exact: true }).click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === 'light',
  );
  await page.locator('.hud-xp-chip').focus();
  await orbit.scrollIntoViewIfNeeded();
  await classic.click();
  await dialog.waitFor();
  await dialog
    .getByRole('link', { name: 'Открыть материал', exact: true })
    .click();
  await page.waitForURL(`**/movie/${ids[25]}`);
  // Keep privacy-mode checks in their own context, without mutating the normal session.
  const restricted = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  await restricted.addCookies(await context.cookies());
  await restricted.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException('Disabled', 'SecurityError');
    };
    Storage.prototype.setItem = () => {
      throw new DOMException('Disabled', 'SecurityError');
    };
    Object.defineProperty(navigator, 'connection', {
      value: { saveData: true },
      configurable: true,
    });
  });
  const privatePage = await restricted.newPage();
  privatePage.on('pageerror', (e) => errors.push(e.message));
  await privatePage.goto(base + '/profile');
  const privateOrbit = privatePage.getByRole('region', {
    name: 'Орбита воспоминаний',
    exact: true,
  });
  await privateOrbit.waitFor();
  assert.equal(await privateOrbit.getAttribute('data-spatial'), null);
  await privateOrbit
    .getByRole('button', { name: 'Список', exact: true })
    .click();
  await privatePage.waitForFunction(() =>
    document
      .querySelector('.memory-orbit')
      ?.classList.contains('orbit-mode-list'),
  );
  await restricted.route('**/api/data', async (route) => {
    const response = await route.fetch(),
      data = await response.json();
    await route.fulfill({ response, json: { ...data, watches: [] } });
  });
  await privatePage.reload();
  await privateOrbit
    .getByText('Первая история ещё впереди', { exact: true })
    .waitFor();
  assert.equal(await privateOrbit.locator('.orbit-card').count(), 0);
  await restricted.close();
  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(base + '/profile');
  await mobile
    .locator('.memory-orbit .orbit-view-switch')
    .getByRole('button', { name: 'Лента', exact: true })
    .click();

  await mobile.locator('.orbit-classics-filter').click();
  await mobile.locator('.memory-classic .orbit-card').click();
  await mobile
    .getByRole('dialog', { name: 'Орбита 25', exact: true })
    .waitFor();
  const box = await mobile
    .getByRole('dialog', { name: 'Орбита 25', exact: true })
    .boundingBox();
  assert(
    box && Math.abs(box.x - (390 - box.width) / 2) < 2,
    'Memory dialog must be centered',
  );
  const background = await mobile
    .getByRole('dialog', { name: 'Орбита 25', exact: true })
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  assert(
    !background.startsWith('rgba('),
    'Dialog must have an opaque background',
  );
  await mobile.screenshot({
    path: '/tmp/mm-orbit-screenshots/memory-mobile.png',
    animations: 'disabled',
  });
  await mobile.close();
  assert.deepEqual(errors, []);
  console.log(
    'Passed production memory orbit: bounded 24-item paging, personal rating styling, actual scroll depth/reduced motion/Save-Data, UTC month+classic filters, own spoiler review, native dialog keyboard/focus, 8 responsive widths, dark/light, persisted/restricted-storage list view, material navigation and empty history. Screenshots /tmp/mm-orbit-screenshots',
  );
} finally {
  await browser.close();
  if (userId) {
    await db.query(
      'delete from mg_comments where user_id=$1 and movie_id=any($2::int[])',
      [userId, ids],
    );
    await db.query(
      'delete from mg_ratings where user_id=$1 and movie_id=any($2::int[])',
      [userId, ids],
    );
    await db.query(
      'delete from mg_watches where user_id=$1 and movie_id=any($2::int[])',
      [userId, ids],
    );
  }
  if (ids.length)
    await db.query('delete from mg_movies where id=any($1::int[])', [ids]);
  await db.end();
}
