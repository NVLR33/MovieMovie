import {
  chooseTheme,
  ambientControl,
  closeSettings,
} from './settings-controls.mjs';
// Real production app/Canvas. All SQL mutations are guarded, local and disposable.
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
const originals = (
  await db.query(
    'select id,title,poster,backdrop from mg_movies where id in (1,2)',
  )
).rows;
const inserted = [];
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    }),
    page = await context.newPage();
  // Make same-origin, deterministic poster fixtures using the browser's PNG encoder.
  const images = await page.evaluate(() => {
    const make = (pink) => {
      const c = document.createElement('canvas');
      c.width = 120;
      c.height = 180;
      const x = c.getContext('2d');
      x.fillStyle = pink ? '#ee64b0' : '#eb661e';
      x.fillRect(0, 0, 120, 180);
      if (!pink) {
        x.fillStyle = '#144bcd';
        x.fillRect(80, 0, 40, 180);
      }
      return c.toDataURL('image/png').split(',')[1];
    };
    return { warm: make(false), pink: make(true) };
  });
  const warm = Buffer.from(images.warm, 'base64'),
    pink = Buffer.from(images.pink, 'base64');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await context.route(base + '/__ambient/**', async (route) => {
    if (route.request().url().includes('slow'))
      await new Promise((resolve) => setTimeout(resolve, 2200));
    await route.fulfill({
      contentType: 'image/png',
      body: route.request().url().includes('pink') ? pink : warm,
    });
  });
  await context.route('https://no-cors.example.test/**', (route) =>
    route.fulfill({
      contentType: 'image/png',
      headers: {
        'access-control-allow-origin': 'https://different-origin.example.test',
      },
      body: warm,
    }),
  );
  await context.addInitScript(() => {
    window.__ambientReads = 0;
    const original = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (...args) {
      window.__ambientReads++;
      return original.apply(this, args);
    };
  });
  await db.query(
    "update mg_movies set title='Ambient orange and blue',poster='/__ambient/warm.png',backdrop='/__ambient/warm.png' where id=1",
  );
  await db.query(
    "update mg_movies set title='Ambient pink',poster='/__ambient/pink.png',backdrop='/__ambient/pink.png' where id=2",
  );
  const insert = async (title, poster) =>
    (
      await db.query(
        "insert into mg_movies(title,description,category,genre,year,duration,poster,backdrop,country)values($1,'Ambient fixture','Фильм','Драма',2020,90,$2,$2,'Россия')returning id",
        [title, poster],
      )
    ).rows[0].id;
  inserted.push(
    await insert(
      'Ambient CORS fallback',
      'https://no-cors.example.test/poster.png',
    ),
    await insert('Ambient slow', '/__ambient/slow.png'),
  );
  const ready = () =>
    page.waitForFunction(
      () => document.documentElement.dataset.ambientStatus === 'ready',
    );
  const state = () =>
    page.evaluate(() => {
      const root = document.documentElement,
        css = getComputedStyle(root);
      return {
        status: root.dataset.ambientStatus,
        mode: root.dataset.ambient,
        primary: root.style.getPropertyValue('--ambient-primary'),
        secondary: root.style.getPropertyValue('--ambient-secondary'),
        accent: css.getPropertyValue('--accent').trim(),
        bg: css.getPropertyValue('--bg').trim(),
        text: css.getPropertyValue('--text').trim(),
        reads: window.__ambientReads,
      };
    });
  const openFromCatalogue = async (title) => {
    await page
      .locator('.film-grid .film-card')
      .filter({ has: page.getByRole('img', { name: title, exact: true }) })
      .click();
    // Browsing now opens a quick look; ambient extraction belongs to the full page.
    const quick = page.locator('dialog.movie-quick-view');
    await quick.getByRole('heading', { name: title, exact: true }).waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.dataset.ambient),
      undefined,
    );
    await quick
      .getByRole('link', { name: 'Полная карточка', exact: true })
      .click();
    await page
      .locator('.movie-detail-page')
      .getByRole('heading', { name: title, exact: true })
      .waitFor();
  };
  await page.goto(base + '/movie/1');
  await ready();
  let current = await state();
  assert(current.primary.includes('235, 102, 30'));
  assert(current.secondary.includes('20, 75, 205'));
  assert.equal(current.reads, 1);
  fs.mkdirSync('/tmp/mm-ambient-screenshots', { recursive: true });
  await page.screenshot({
    path: '/tmp/mm-ambient-screenshots/orange-blue-desktop.png',
    fullPage: false,
  });
  const warmAccent = current.accent;
  await page.locator('.back-link').click();
  await page.waitForURL('**/catalog');
  await page.waitForFunction(
    () =>
      !document.documentElement.dataset.ambient &&
      !document.documentElement.style.getPropertyValue('--ambient-bg'),
  );
  await openFromCatalogue('Ambient pink');
  await ready();
  current = await state();
  assert(current.primary.includes('238, 100, 176'));
  assert.notEqual(current.accent, warmAccent);
  assert.equal(current.reads, 2);
  await page.screenshot({
    path: '/tmp/mm-ambient-screenshots/pink-desktop.png',
  });
  // Revisit through client navigation: extraction is cached, without scanning canvas again.
  await page.locator('.back-link').click();
  await page.waitForURL('**/catalog');
  await openFromCatalogue('Ambient orange and blue');
  await ready();
  assert.equal((await state()).reads, 2);
  await (await ambientControl(page)).click();
  await page.waitForFunction(
    () => document.documentElement.dataset.ambientStatus === 'off',
  );
  assert.equal((await state()).mode, undefined);
  assert.equal(
    await page.evaluate(() => localStorage.getItem('mg_ambient_canvas')),
    'false',
  );
  await page.reload();
  await page.waitForFunction(
    () => document.documentElement.dataset.ambientStatus === 'off',
  );
  assert.equal(await (await ambientControl(page)).isChecked(), false);
  assert.equal((await state()).reads, 0);
  await (await ambientControl(page)).click();
  await ready();
  // Theme changes recompute contrast-safe surfaces but do not read the poster again.
  await chooseTheme(page, 'Светлая');
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === 'light',
  );
  await page.waitForFunction(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--ambient-on-accent')
      .includes('255'),
  );
  current = await state();
  const contrast = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.setProperty('transition', 'none', 'important');
    probe.style.setProperty('animation', 'none', 'important');
    document.body.append(probe);
    const luminance = (variable) => {
      probe.style.color = `var(${variable})`;
      const rgb = getComputedStyle(probe)
        .color.match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number)
        .map((v) => {
          v /= 255;
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const foreground = luminance('--text'),
      background = luminance('--bg');
    probe.remove();
    return (
      (Math.max(foreground, background) + 0.05) /
      (Math.min(foreground, background) + 0.05)
    );
  });
  assert(
    contrast >= 7,
    `Light theme retains strong text contrast, got ${contrast}`,
  );
  assert.equal(current.reads, 1);
  await page.screenshot({
    path: '/tmp/mm-ambient-screenshots/light-desktop.png',
  });
  for (const width of [320, 390, 760, 1280]) {
    await page.setViewportSize({ width, height: 950 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    const toggle = await (await ambientControl(page)).boundingBox();
    assert(toggle && toggle.width >= 44 && toggle.height >= 40);
  }
  await closeSettings(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: '/tmp/mm-ambient-screenshots/light-mobile.png',
  });
  // Reduced motion disables interpolation, not color accessibility.
  assert.equal(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).transitionDuration,
    ),
    '0s',
  );
  await page.setViewportSize({ width: 1280, height: 1000 });
  await chooseTheme(page, 'Тёмная');
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === 'dark',
  );
  await page.locator('.back-link').click();
  await page.waitForURL('**/catalog');
  await openFromCatalogue('Ambient CORS fallback');
  await page.waitForFunction(
    () => document.documentElement.dataset.ambientStatus === 'fallback',
  );
  assert.equal((await state()).mode, undefined);
  assert.equal(await page.locator('.cinema-atmosphere').count(), 1);
  await page.locator('.back-link').click();
  await page.waitForURL('**/catalog');
  await openFromCatalogue('Ambient slow');
  await page.locator('.back-link').click();
  await page.waitForURL('**/catalog');
  await openFromCatalogue('Ambient pink');
  await ready();
  await page.waitForTimeout(2600);
  assert(
    (await state()).primary.includes('238, 100, 176'),
    'Late poster response must not overwrite current film',
  );
  // Regular animations are finite 700 ms transitions, never an infinite color loop.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  assert(
    (
      await page.evaluate(
        () => getComputedStyle(document.documentElement).transitionDuration,
      )
    ).includes('0.7s'),
  );
  // No-canvas privacy mode must also degrade to the original neutral/blurred appearance.
  const restricted = await browser.newContext({ reducedMotion: 'reduce' });
  await restricted.route(base + '/__ambient/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: warm }),
  );
  await restricted.addInitScript(() => {
    CanvasRenderingContext2D.prototype.getImageData = () => {
      throw new DOMException('Canvas disabled', 'SecurityError');
    };
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage disabled', 'SecurityError');
    };
  });
  const privatePage = await restricted.newPage();
  await privatePage.goto(base + '/movie/1');
  await privatePage.waitForFunction(
    () => document.documentElement.dataset.ambientStatus === 'fallback',
  );
  await (await ambientControl(privatePage)).click();
  await privatePage.waitForFunction(
    () => document.documentElement.dataset.ambientStatus === 'off',
  );
  assert.equal(await (await ambientControl(privatePage)).isChecked(), false);
  await restricted.close();
  // Save-Data skips the additional extraction request entirely.
  const saver = await browser.newContext();
  await saver.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', {
      value: { saveData: true },
      configurable: true,
    });
    window.__ambientReads = 0;
  });
  const saverPage = await saver.newPage();
  await saverPage.goto(base + '/movie/1');
  await saverPage.waitForFunction(
    () => document.documentElement.dataset.ambientStatus === 'data-saver',
  );
  assert.equal(await saverPage.evaluate(() => window.__ambientReads), 0);
  await saver.close();
  assert.deepEqual(errors, []);
  console.log(
    'Passed actual Canvas + production browser: orange/blue and pink extraction, full-shell palette, client navigation/cache/cleanup, persisted opt-out, light/dark recompute, four responsive widths, reduced motion/700ms transitions, CORS/canvas/storage failure, Save-Data and stale-image race. Screenshots: /tmp/mm-ambient-screenshots',
  );
} finally {
  await browser.close();
  for (const film of originals)
    await db.query(
      'update mg_movies set title=$2,poster=$3,backdrop=$4 where id=$1',
      [film.id, film.title, film.poster, film.backdrop],
    );
  if (inserted.length)
    await db.query('delete from mg_movies where id=any($1::int[])', [inserted]);
  await db.end();
}
