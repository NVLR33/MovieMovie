// Production browser: reachable navigation/actions on a disposable, marker-guarded local DB.
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
  (await db.query("SELECT value FROM mm_audit_fixture WHERE key='isolated'"))
    .rows[0]?.value,
  'yes',
);
const browser = await pw.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter((a) => a !== '--single-process'),
  headless: true,
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
    hasTouch: true,
  });
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const dock = page.getByRole('navigation', {
    name: 'Мобильная навигация',
    exact: true,
  });
  await page.goto(base + '/');
  await dock.waitFor();
  for (const width of [320, 360, 390, 600, 760, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      'Overflow ' + width,
    );
    assert.equal(
      await dock.isVisible(),
      width <= 760,
      'Dock breakpoint ' + width,
    );
    if (width <= 760) {
      const boxes = await dock
        .locator(':scope > *')
        .evaluateAll((els) =>
          els.map((el) => ({
            w: el.getBoundingClientRect().width,
            h: el.getBoundingClientRect().height,
          })),
        );
      assert.equal(boxes.length, 5);
      assert(boxes.every((b) => b.w >= 44 && b.h >= 44));
      assert.equal(await page.locator('.sidebar').isVisible(), false);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await dock.getByRole('link', { name: 'Профиль', exact: true }).click();
  await page.locator('.auth-modal').waitFor();
  await dock.waitFor({ state: 'hidden' });
  await page.locator('.auth-modal .modal-close').click();
  await dock.waitFor();
  await dock.getByRole('button', { name: 'Ещё', exact: true }).click();
  let more = page.getByRole('dialog', {
    name: 'Ещё в moviemovie',
    exact: true,
  });
  await more.waitFor();
  assert.equal(
    await page.evaluate(() => document.body.style.overflow),
    'hidden',
  );
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    assert(await more.evaluate((el) => el.contains(document.activeElement)));
  }
  await page.keyboard.press('Escape');
  await more.waitFor({ state: 'detached' });
  await page.waitForFunction(
    () =>
      document.querySelector('.mobile-bottom-nav > button') ===
      document.activeElement,
  );
  await dock.getByRole('button', { name: 'Ещё', exact: true }).click();
  await more.getByRole('link', { name: 'Любимое', exact: true }).click();
  await page.waitForURL('**/favorites');
  await dock.getByRole('button', { name: 'Ещё', exact: true }).waitFor();
  assert.equal(
    await dock
      .getByRole('button', { name: 'Ещё', exact: true })
      .getAttribute('aria-current'),
    'page',
  );
  await dock.getByRole('link', { name: 'Каталог', exact: true }).click();
  await page.waitForURL('**/catalog');
  assert.equal(
    await dock
      .getByRole('link', { name: 'Каталог', exact: true })
      .getAttribute('aria-current'),
    'page',
  );
  await page.goBack();
  await page.waitForURL('**/favorites');
  assert.equal(
    await dock
      .getByRole('button', { name: 'Ещё', exact: true })
      .getAttribute('aria-current'),
    'page',
  );
  // Focus + a mocked visualViewport resize exercise keyboard handling without OS-specific automation.
  const search = page.getByRole('searchbox', {
    name: 'Найти фильм или сериал',
    exact: true,
  });
  await search.focus();
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', {
      value: 500,
      configurable: true,
    });
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  await page.waitForFunction(
    () => document.documentElement.dataset.mobileKeyboard === 'open',
  );
  await dock.waitFor({ state: 'hidden' });
  await search.blur();
  await page.waitForFunction(
    () => !document.documentElement.dataset.mobileKeyboard,
  );
  await page.evaluate(() => {
    delete window.visualViewport.height;
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  await dock.waitFor();
  const suffix = Date.now();
  const signup = await context.request.post(base + '/api/auth', {
    data: {
      action: 'register',
      email: `mobile-${suffix}@example.test`,
      username: `Mobile${suffix}`,
      password: 'mobile-browser-password',
    },
  });
  assert.equal(signup.status(), 200);
  const account = (await signup.json()).user;
  await page.goto(base + '/movie/1');
  const actions = page.getByRole('group', { name: /^Быстрые действия:/ });
  await actions.waitFor();
  assert.equal(
    await dock
      .getByRole('link', { name: 'Каталог', exact: true })
      .getAttribute('aria-current'),
    'page',
  );
  for (const width of [320, 390, 600, 760]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => scrollTo(0, 700));
    const box = await actions.boundingBox(),
      nav = await dock.boundingBox();
    assert(box && nav);
    assert(
      Math.abs(box.y + box.height - nav.y) < 2,
      'Action dock must sit above navigation',
    );
    assert(box.y >= 0 && nav.y + nav.height <= 845);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  fs.mkdirSync('/tmp/mm-mobile-screenshots', { recursive: true });
  await page.screenshot({
    path: '/tmp/mm-mobile-screenshots/movie-mobile.png',
    fullPage: false,
  });
  await actions
    .getByRole('button', { name: 'Оценить материал', exact: true })
    .click();
  const rating = page.getByRole('dialog', { name: 'Твоя оценка', exact: true });
  await rating.waitFor();
  await dock.waitFor({ state: 'hidden' });
  await actions.waitFor({ state: 'hidden' });
  for (const width of [320, 390, 760]) {
    await page.setViewportSize({ width, height: 844 });
    assert(await rating.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    const sizes = await rating
      .locator('.mobile-rating-values button')
      .evaluateAll((els) =>
        els.map((el) => ({
          w: el.getBoundingClientRect().width,
          h: el.getBoundingClientRect().height,
        })),
      );
    assert.equal(sizes.length, 20);
    assert(sizes.every((b) => b.w >= 44 && b.h >= 44));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await rating
    .getByRole('button', { name: 'Выбрать 8.5 из 10', exact: true })
    .click();
  await page.screenshot({
    path: '/tmp/mm-mobile-screenshots/rating-sheet.png',
  });
  await rating
    .getByRole('button', { name: 'Сохранить оценку', exact: true })
    .click();
  await rating.waitFor({ state: 'detached' });
  await actions
    .getByRole('button', { name: 'Оценить материал', exact: true })
    .getByText('Моя оценка 8.5', { exact: true })
    .waitFor();
  assert.equal(
    (
      await db.query(
        'select value from mg_ratings where user_id=$1 and movie_id=1',
        [account.id],
      )
    ).rows[0].value,
    8.5,
  );
  await actions.getByRole('button', { name: 'Отзывы', exact: true }).click();
  const reviews = page.getByRole('dialog', {
    name: 'Мнения сообщества',
    exact: true,
  });
  await reviews.waitFor();
  await dock.waitFor({ state: 'hidden' });
  await reviews
    .getByRole('textbox', { name: 'Текст отзыва', exact: true })
    .fill('Мобильный черновик');
  await page.keyboard.press('Escape');
  await reviews.waitFor({ state: 'detached' });
  await actions.getByRole('button', { name: 'Отзывы', exact: true }).click();
  assert.equal(
    await reviews
      .getByRole('textbox', { name: 'Текст отзыва', exact: true })
      .inputValue(),
    'Мобильный черновик',
  );
  await page.keyboard.press('Escape');
  await page.evaluate(() =>
    document.documentElement.style.setProperty('--mobile-safe-bottom', '24px'),
  );
  await page.waitForFunction(
    () =>
      Math.round(
        document.querySelector('.mobile-bottom-nav').getBoundingClientRect()
          .height,
      ) === 88,
  );
  const safeBox = await dock.boundingBox();
  assert.equal(Math.round(safeBox.height), 88);
  await page.evaluate(() =>
    document.documentElement.style.removeProperty('--mobile-safe-bottom'),
  );
  await dock.getByRole('button', { name: 'Ещё', exact: true }).click();
  await more.waitFor();
  await page.screenshot({ path: '/tmp/mm-mobile-screenshots/more-sheet.png' });
  await page.setViewportSize({ width: 1024, height: 844 });
  await more.waitFor({ state: 'detached' });
  await dock.waitFor({ state: 'hidden' });
  await actions.waitFor({ state: 'hidden' });
  assert.equal(await page.locator('.sidebar').isVisible(), true);
  assert.deepEqual(errors, []);
  console.log(
    'Passed mobile production browser: five tabs / eight breakpoints, guest auth, More dialog focus/Escape/history, keyboard viewport, sticky material actions after scroll, 20 accessible half-step ratings + real persistence, review draft, safe area, rotation and unchanged desktop sidebar. Screenshots: /tmp/mm-mobile-screenshots',
  );
} finally {
  await browser.close();
  await db.end();
}
