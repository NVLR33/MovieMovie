// Real production HUD and server XP. Never runs against a remote or unmarked DB.
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
let userId;
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      reducedMotion: 'no-preference',
    }),
    page = await context.newPage();
  await context.addInitScript(() => {
    window.__hudAnimations = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      if (this.matches('.hud-xp-rail > i,.hud-level-track > i'))
        window.__hudAnimations.push(frames);
      return animate.call(this, frames, options);
    };
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const stamp = Date.now();
  const signup = await context.request.post(base + '/api/auth', {
    data: {
      action: 'register',
      email: `hud-${stamp}@example.test`,
      username: `HUD${stamp}`,
      password: 'hud-browser-test-password',
    },
  });
  assert.equal(signup.status(), 200);
  userId = (await signup.json()).user.id;
  await db.query('update mg_users set xp=480 where id=$1', [userId]);
  const meter = page.getByRole('progressbar', {
    name: 'Опыт текущего уровня',
    exact: true,
  });
  const expectXP = async (xp) => {
    await page.waitForFunction(
      (value) =>
        document
          .querySelector('.hud-xp-rail')
          ?.getAttribute('aria-valuenow') === String(value % 500),
      xp,
    );
    assert.equal(await meter.getAttribute('aria-valuenow'), String(xp % 500));
    assert.equal(
      await page.locator('.hud-xp-level b').innerText(),
      String(Math.floor(xp / 500) + 1),
    );
  };
  await page.goto(base + '/movie/1');
  await expectXP(480);
  assert.equal(
    await page.locator('.hud-xp-feedback').count(),
    0,
    'Initial load is not a reward',
  );
  // A pending request pulses real loading borders, but does not fabricate XP optimistically.
  let release;
  await page.route('**/api/action', async (route) => {
    const data = route.request().postDataJSON();
    if (data.action === 'watch')
      await new Promise((resolve) => (release = resolve));
    await route.continue();
  });
  await page
    .getByRole('button', { name: 'Отметить просмотренным', exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelector('.app-shell')?.dataset.hudBusy === 'true',
  );
  await expectXP(480);
  await page.waitForTimeout(150);
  assert(release);
  release();
  await expectXP(515);
  assert(
    await page.evaluate(() =>
      window.__hudAnimations.some(
        (frames) =>
          frames.some((f) => f.width === '100%') &&
          frames.some((f) => f.width === '0%'),
      ),
    ),
    'Level-up must fill then wrap the rail',
  );
  await page.getByRole('status').filter({ hasText: '+35 XP' }).waitFor();
  assert(
    (await page.locator('.hud-xp-announcer').textContent()).includes(
      'Новый уровень 2',
    ),
  );
  assert.equal(
    Number(
      (await db.query('select xp from mg_users where id=$1', [userId])).rows[0]
        .xp,
    ),
    515,
  );
  await page.unroute('**/api/action');
  await page.locator('.hud-xp-chip').click();
  await page.waitForURL('**/profile');
  await page.getByRole('region', { name: 'Личный командный центр' }).waitFor();
  assert.equal(await page.locator('.hud-metric').count(), 4);
  assert.equal(
    await page.locator('.hud-metric-watched strong').innerText(),
    '1',
  );
  assert.equal(
    await page.locator('.hud-metric-time strong').innerText(),
    '1 ч',
  );
  assert.equal(await page.locator('.hud-bento > [data-hud-tile]').count(), 5);
  assert.equal(
    await page
      .getByRole('progressbar', {
        name: 'Прогресс уровня в профиле',
        exact: true,
      })
      .getAttribute('aria-valuenow'),
    '15',
  );
  await page.waitForFunction(
    () => document.querySelector('.app-shell')?.dataset.hudBusy === 'false',
  );
  assert.equal(
    await page
      .locator('.hud-level-panel')
      .evaluate((el) => getComputedStyle(el, '::after').animationName),
    'none',
  );
  // Real in-flight data refresh state, finite loading heartbeat and reduced-motion override.
  await page.route('**/api/data', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.continue();
  });
  await page
    .getByRole('button', { name: 'Настроить профиль', exact: true })
    .click();
  // Theme mutation causes the same full-data refresh as other profile actions.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.theme-menu').hover();
  await page.getByRole('button', { name: 'Светлая', exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('.app-shell')?.dataset.hudBusy === 'true',
  );
  assert.equal(
    await page
      .locator('.hud-level-panel')
      .evaluate((el) => getComputedStyle(el, '::after').animationName),
    'none',
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  assert.equal(
    await page
      .locator('.hud-level-panel')
      .evaluate((el) => getComputedStyle(el, '::after').animationName),
    'hud-sync',
  );
  await page.waitForFunction(
    () => document.querySelector('.app-shell')?.dataset.hudBusy === 'false',
  );
  assert.equal(
    await page
      .locator('.hud-level-panel')
      .evaluate((el) => getComputedStyle(el, '::after').animationName),
    'none',
  );
  await page.unroute('**/api/data');
  await page.getByRole('button', { name: 'Готово', exact: true }).click();
  fs.mkdirSync('/tmp/mm-hud-screenshots', { recursive: true });
  await page.screenshot({
    path: '/tmp/mm-hud-screenshots/profile-light-desktop.png',
    fullPage: true,
  });
  await page.locator('.theme-menu').hover();
  await page.getByRole('button', { name: 'Тёмная', exact: true }).click();
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.theme === 'dark' &&
      document.querySelector('.app-shell')?.dataset.hudBusy === 'false',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(
    await page
      .locator('.hud-level-track > i')
      .evaluate((el) => getComputedStyle(el).transitionDuration),
    '0s',
  );
  await page.locator('.hud-section-label').hover();
  await page.screenshot({
    path: '/tmp/mm-hud-screenshots/profile-dark-desktop.png',
    fullPage: true,
  });
  for (const width of [320, 360, 390, 600, 760, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Profile overflow at ${width}`,
    );
    const chip = await page.locator('.hud-xp-chip').boundingBox();
    assert(chip && chip.width >= 44 && chip.height >= 44);
    const search = await page.locator('.top-search').boundingBox();
    assert(search && search.width >= 140);
    const tiles = await page
      .locator('.hud-bento > [data-hud-tile]')
      .evaluateAll((els) =>
        els.map((el) => ({
          x: el.getBoundingClientRect().x,
          w: el.getBoundingClientRect().width,
        })),
      );
    if (width <= 760)
      assert(tiles.every((t) => Math.abs(t.w - tiles[0].w) < 1));
    if (width === 1920)
      assert(tiles[0].w > tiles[1].w, 'Desktop bento should be asymmetric');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: '/tmp/mm-hud-screenshots/profile-dark-mobile.png',
    fullPage: true,
  });
  // Goal shortcut is real navigation; returning does not replay a reward.
  await page.locator('.hud-next-mission').click();
  await page.waitForURL('**/achievements');
  await expectXP(515);
  await page.goto(base + '/movie/1');
  await expectXP(515);
  assert.equal(await page.locator('.hud-xp-feedback').count(), 0);
  await page.getByRole('button', { name: 'Просмотрено', exact: true }).click();
  await expectXP(480);
  await page.getByRole('status').filter({ hasText: '−35 XP' }).waitFor();
  assert(
    !(await page.locator('.hud-xp-announcer').innerText()).includes(
      'Новый уровень',
    ),
  );
  // Failure never increases XP. Nor does bookmarking, despite optimistic collection state.
  await page.route('**/api/action', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'HUD isolated failure' }),
    }),
  );
  await page
    .getByRole('button', { name: 'Отметить просмотренным', exact: true })
    .click();
  await page.getByText('HUD isolated failure', { exact: true }).waitFor();
  await expectXP(480);
  await page.unroute('**/api/action');
  await page
    .getByRole('group', { name: /Быстрые действия:/ })
    .getByRole('button', { name: 'Добавить в список просмотра', exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelector('.app-shell')?.dataset.hudBusy === 'false',
  );
  await expectXP(480);
  assert.equal(
    Number(
      (await db.query('select xp from mg_users where id=$1', [userId])).rows[0]
        .xp,
    ),
    480,
  );
  // First rating is +10 XP, editing that rating is not another reward.
  const rate = async (value) => {
    await page
      .getByRole('button', { name: 'Оценить материал', exact: true })
      .click();
    const sheet = page.getByRole('dialog', {
      name: 'Твоя оценка',
      exact: true,
    });
    await sheet
      .getByRole('button', { name: `Выбрать ${value} из 10`, exact: true })
      .click();
    await sheet
      .getByRole('button', { name: 'Сохранить оценку', exact: true })
      .click();
    await sheet.waitFor({ state: 'detached' });
    await page.waitForFunction(
      () => document.querySelector('.app-shell')?.dataset.hudBusy === 'false',
    );
  };
  await rate('8.5');
  await expectXP(490);
  await page.getByRole('status').filter({ hasText: '+10 XP' }).waitFor();
  await rate('9');
  await expectXP(490);
  assert.equal(
    Number(
      (await db.query('select xp from mg_users where id=$1', [userId])).rows[0]
        .xp,
    ),
    490,
  );
  await page.reload();
  await expectXP(490);
  assert.equal(await page.locator('.hud-xp-feedback').count(), 0);
  const guest = await browser.newPage({
    viewport: { width: 320, height: 844 },
  });
  await guest.goto(base + '/profile');
  await guest.getByText('Твоя киновселенная ждёт', { exact: true }).waitFor();
  assert.equal(await guest.locator('.hud-xp-chip').count(), 0);
  await guest.close();
  assert.deepEqual(errors, []);
  console.log(
    'Passed HUD production browser: real watch +35/undo -35, first rating +10 (edit +0) and level rollover, server-only XP/no reward on bookmark/failure/initial load, live loading border/reduced motion, 8 widths/asymmetric bento, goal navigation, dark/light and guest. Screenshots /tmp/mm-hud-screenshots',
  );
} finally {
  await browser.close();
  await db.end();
}
