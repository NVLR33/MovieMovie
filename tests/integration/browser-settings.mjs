// Production settings UI. Any account fixture is restricted to marker-guarded local SQL.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { Client } from 'pg';
import {
  openSettings,
  closeSettings,
  chooseTheme,
  ambientControl,
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
});
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'no-preference',
    }),
    page = await context.newPage(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let writes = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/api/action')) writes++;
  });
  await page.goto(base + '/');
  const trigger = page.getByRole('button', {
    name: 'Настройки сайта',
    exact: true,
  });
  await trigger.waitFor();
  assert.equal(await trigger.count(), 1);
  assert.equal(
    await page
      .locator(
        '.language-switch,.theme-menu,.season-theme-menu,.ambient-toggle',
      )
      .count(),
    0,
  );
  let dialog = await openSettings(page);
  assert.equal(await dialog.getByRole('radio').count(), 13);
  assert.equal(await dialog.getByRole('switch').count(), 3);
  assert(
    await dialog
      .locator('.settings-close')
      .evaluate((el) => el === document.activeElement),
  );
  for (let i = 0; i < 36; i++) {
    await page.keyboard.press('Tab');
    assert(await dialog.evaluate((el) => el.contains(document.activeElement)));
  }
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  await page.waitForFunction(() =>
    document.activeElement?.classList.contains('site-settings-trigger'),
  );
  for (const [name, id] of [
    ['Светлая', 'light'],
    ['Розовая', 'pink'],
    ['Фиолетовая', 'purple'],
    ['Жёлтая', 'yellow'],
    ['Тёмная', 'dark'],
  ]) {
    await chooseTheme(page, name);
    await page.waitForFunction(
      (value) => document.documentElement.dataset.theme === value,
      id,
    );
    assert.equal(
      await page.evaluate(() => localStorage.getItem('mg_theme')),
      id,
    );
  }
  assert.equal(
    writes,
    0,
    'Guest appearance preferences must not send profile writes',
  );
  dialog = await openSettings(page);
  await dialog.getByRole('radio', { name: 'English', exact: true }).check();
  await page.waitForFunction(
    () =>
      localStorage.getItem('mg_lang') === 'en' &&
      document.documentElement.lang === 'en',
  );
  await dialog
    .getByRole('heading', { name: 'Site settings', exact: true })
    .waitFor();
  await dialog.getByRole('radio', { name: 'Русский', exact: true }).check();
  await page.waitForFunction(() => document.documentElement.lang === 'ru');
  await dialog.getByRole('radio', { name: 'Зима', exact: true }).check();
  await page.waitForFunction(
    () => document.documentElement.dataset.season === 'winter',
  );
  assert.equal(await page.locator('.season-particle').count(), 16);
  const particles = dialog.getByRole('switch', {
      name: 'Сезонные частицы',
      exact: true,
    }),
    glow = dialog.getByRole('switch', {
      name: 'Сезонное свечение',
      exact: true,
    });
  await particles.uncheck();
  await page.waitForFunction(
    () => document.querySelectorAll('.season-particle').length === 0,
  );
  await glow.uncheck();
  await page.waitForFunction(
    () => document.documentElement.dataset.seasonGlow === 'off',
  );
  await dialog.getByRole('radio', { name: 'Выключено', exact: true }).check();
  assert(await particles.isDisabled());
  assert(await glow.isDisabled());
  await dialog.getByRole('radio', { name: 'Лето', exact: true }).check();
  assert.equal(await particles.isChecked(), false);
  assert.equal(await glow.isChecked(), false);
  await particles.check();
  await page.waitForFunction(
    () => document.querySelectorAll('.season-particle').length === 16,
  );
  await (await ambientControl(page)).uncheck();
  assert.equal(
    await page.evaluate(() => localStorage.getItem('mg_ambient_canvas')),
    'false',
  );
  await closeSettings(page);
  await page.reload();
  dialog = await openSettings(page);
  assert(
    await dialog.getByRole('radio', { name: 'Лето', exact: true }).isChecked(),
  );
  assert.equal(
    await dialog
      .getByRole('switch', { name: 'Сезонное свечение', exact: true })
      .isChecked(),
    false,
  );
  assert.equal(
    await dialog
      .getByRole('switch', { name: 'Атмосфера фильма', exact: true })
      .isChecked(),
    false,
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await dialog
    .getByText(
      'В системе включено уменьшение движения. Сайт учитывает эту настройку.',
      { exact: true },
    )
    .waitFor();
  assert.equal(
    await page
      .locator('.season-particles')
      .evaluate((el) => getComputedStyle(el).display),
    'none',
  );
  fs.mkdirSync('/tmp/mm-settings-screenshots', { recursive: true });
  await dialog.locator('.settings-close').focus();
  await dialog.screenshot({
    path: '/tmp/mm-settings-screenshots/settings-dark.png',
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
    assert(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      `Settings overflow ${width}`,
    );
    const box = await dialog.boundingBox();
    assert(box && box.width <= width + 1 && box.height <= 902);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog.locator('.settings-close').focus();
  await page.screenshot({
    path: '/tmp/mm-settings-screenshots/settings-mobile.png',
  });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  await page.waitForFunction(() =>
    document.activeElement?.classList.contains('site-settings-trigger'),
  );
  // Narrow viewport keeps the one entry point reachable, including on a material page.
  await page.goto(base + '/movie/1');
  assert.equal(await page.locator('.site-settings-trigger').count(), 1);
  assert.equal(await page.locator('.ambient-toggle').count(), 0);
  dialog = await openSettings(page);
  await dialog.locator('.settings-reset summary').click();
  await dialog
    .getByRole('button', { name: 'Восстановить эти настройки', exact: true })
    .click();
  await page.waitForFunction(
    () =>
      localStorage.getItem('mg_season_mode') === 'auto' &&
      localStorage.getItem('mg_ambient_canvas') === 'true',
  );
  assert(
    await dialog
      .getByRole('radio', { name: 'Автоматически', exact: true })
      .isChecked(),
  );
  assert(
    await dialog
      .getByRole('switch', { name: 'Сезонное свечение', exact: true })
      .isChecked(),
  );
  await closeSettings(page);
  await chooseTheme(page, 'Светлая');
  dialog = await openSettings(page);
  await dialog.locator('.settings-close').focus();
  await page.screenshot({
    path: '/tmp/mm-settings-screenshots/settings-light-mobile.png',
  });
  await closeSettings(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  dialog = await openSettings(page);
  await dialog.locator('.settings-close').focus();
  await dialog.screenshot({
    path: '/tmp/mm-settings-screenshots/settings-light.png',
    animations: 'disabled',
  });
  await closeSettings(page);
  // Account persistence + explicit retry; local appearance is kept on a failed profile write.
  const stamp = Date.now(),
    signup = await context.request.post(base + '/api/auth', {
      data: {
        action: 'register',
        email: `settings-${stamp}@example.test`,
        username: `Settings${stamp}`,
        password: 'settings-isolated-browser-password',
      },
    });
  assert.equal(signup.status(), 200);
  const userId = (await signup.json()).user.id;
  await page.reload();
  await page.waitForFunction(() => document.querySelector('.hud-xp-chip'));
  const themeRefresh = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/data') && response.status() === 200,
  );
  await chooseTheme(page, 'Фиолетовая');
  await themeRefresh;
  assert.equal(
    (await db.query('select theme from mg_users where id=$1', [userId])).rows[0]
      .theme,
    'purple',
  );
  await context.route('**/api/action', (route) =>
    route.request().postDataJSON()?.action === 'profile'
      ? route.fulfill({
          status: 500,
          json: { error: 'Тестовый отказ синхронизации' },
        })
      : route.continue(),
  );
  dialog = await openSettings(page);
  await dialog.getByRole('radio', { name: 'Жёлтая', exact: true }).check();
  await dialog
    .getByRole('button', {
      name: 'Повторить синхронизацию профиля',
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.theme),
    'yellow',
  );
  assert.equal(
    (await db.query('select theme from mg_users where id=$1', [userId])).rows[0]
      .theme,
    'purple',
  );
  await context.unroute('**/api/action');
  await dialog
    .getByRole('button', {
      name: 'Повторить синхронизацию профиля',
      exact: true,
    })
    .click();
  await dialog.getByText('Настройки применены.', { exact: true }).waitFor();
  assert.equal(
    (await db.query('select theme from mg_users where id=$1', [userId])).rows[0]
      .theme,
    'yellow',
  );
  await dialog.getByRole('radio', { name: 'English', exact: true }).check();
  await dialog.getByText('Settings applied.', { exact: true }).waitFor();
  assert.equal(
    (await db.query('select language from mg_users where id=$1', [userId]))
      .rows[0].language,
    'en',
  );
  await closeSettings(page);
  // No storage access should crash the panel or prevent temporary preference changes.
  const restricted = await browser.newContext({
    viewport: { width: 390, height: 844 },
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
  const privatePage = await restricted.newPage();
  privatePage.on('pageerror', (error) => errors.push(error.message));
  await privatePage.goto(base + '/');
  await chooseTheme(privatePage, 'Светлая');
  assert.equal(
    await privatePage.evaluate(() => document.documentElement.dataset.theme),
    'light',
  );
  await (await ambientControl(privatePage)).uncheck();
  assert.equal(await (await ambientControl(privatePage)).isChecked(), false);
  await restricted.close();
  assert.deepEqual(errors, []);
  console.log(
    'Passed unified production settings: one reachable entry, five live themes/two languages, calendar/manual/off seasons, independent particles/glow/ambient, reload and account persistence, reduced motion, local/profile failure retry, reset scope, native keyboard/Escape/focus, 8 widths/light/dark and restricted storage. Screenshots /tmp/mm-settings-screenshots',
  );
} finally {
  await browser.close();
  await db.end();
}
