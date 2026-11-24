// Cross-page visual contract against the actual production build and isolated local SQL.
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
  });
  await context.addInitScript(() => {
    localStorage.setItem('mg_season_mode', 'off');
  });
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (
      m.type() === 'error' &&
      /hydration|Minified React error/i.test(m.text())
    )
      errors.push(m.text());
  });
  const stamp = Date.now(),
    studio = 'DesignFixture' + stamp,
    signup = await context.request.post(base + '/api/auth', {
      data: {
        action: 'register',
        email: `design-${stamp}@example.test`,
        username: `Design${stamp}`,
        password: 'design-isolated-browser-password',
      },
    });
  assert.equal(signup.status(), 200);
  userId = (await signup.json()).user.id;
  for (let n = 0; n < 6; n++) {
    const id = (
      await db.query(
        "insert into mg_movies(title,description,category,genre,studio,year,duration,poster,country,age_rating,views)values($1,'Проверка общей визуальной системы','Фильм','Драма',$2,2024,100,$3,'Россия','12+',1000)returning id",
        [
          'Единый дизайн ' + n,
          studio,
          n === 5
            ? '/brand/intentional-missing-poster.png'
            : '/brand/moviemovie-logo.png',
        ],
      )
    ).rows[0].id;
    ids.push(id);
    await db.query(
      'insert into mg_ratings(user_id,movie_id,value)values($1,$2,9)',
      [userId, id],
    );
    await db.query('insert into mg_favorites(user_id,movie_id)values($1,$2)', [
      userId,
      id,
    ]);
    await db.query('insert into mg_watches(user_id,movie_id)values($1,$2)', [
      userId,
      id,
    ]);
  }
  fs.mkdirSync('/tmp/mm-design-screenshots', { recursive: true });
  const capture = {
    animations: 'disabled',
    style:
      '.topbar,.mobile-bottom-nav,.mobile-movie-actions{visibility:hidden!important;}',
  };
  async function open(path) {
    await page.goto(base + path);
    await page.locator('.hud-xp-chip').waitFor();
    await page.evaluate(() => document.fonts.ready);
  }
  async function styles(card, title) {
    return page
      .locator(card)
      .first()
      .evaluate((el, title) => {
        const s = getComputedStyle(el),
          poster = el.querySelector('.cinema-poster'),
          p = poster && getComputedStyle(poster),
          heading = el.querySelector(title),
          h = heading && getComputedStyle(heading),
          badge = el.querySelector('.cinema-rating'),
          b = badge && getComputedStyle(badge);
        return {
          radius: s.borderRadius,
          bg: s.backgroundColor,
          ratio: p?.aspectRatio,
          font: h?.fontFamily,
          size: h?.fontSize,
          line: h?.lineHeight,
          badgeRadius: b?.borderRadius,
          badgeSize: b?.fontSize,
        };
      }, title);
  }
  let reference;
  for (const theme of ['dark', 'light']) {
    await open('/catalog?studio=' + studio);
    await page.locator('.film-card').first().waitFor();
    await chooseTheme(page, theme === 'dark' ? 'Тёмная' : 'Светлая');
    reference = await styles('.film-card', '.card-info h3');
    assert.equal(reference.radius, '14px');
    assert.equal(reference.size, '13px');
    assert.equal(reference.badgeRadius, '8px');
    await page
      .locator('.film-card')
      .filter({ hasText: 'Единый дизайн 5' })
      .scrollIntoViewIfNeeded();
    await page
      .locator('.cinema-poster[data-poster-state="fallback"]')
      .waitFor();
    assert.equal(
      await page.locator('.film-grid .cinema-poster-fallback').count(),
      1,
    );
    for (const width of [320, 390, 760, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `Catalog overflow ${width}`,
      );
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const [path, card, title, name] of [
      ['/', '.home-five-card', '.home-five-caption strong', 'top-five'],
      ['/', '.weekly-pulse-card', '.weekly-pulse-title h3', 'pulse'],
      ['/collab?view=studio', '.showcase-film', 'strong', 'collections'],
      ['/world', '.world-film', 'h3', 'world'],
    ]) {
      await open(path);
      await page.locator(card).first().waitFor();
      assert.deepEqual(
        await styles(card, title),
        reference,
        `Catalog contract ${name}/${theme}`,
      );
      for (const width of [320, 360, 390, 600, 760, 1024, 1280, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.waitForFunction(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        );
        assert.equal(
          (await styles(card, title)).ratio,
          reference.ratio,
          `${name} poster ratio at ${width}`,
        );
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      const section =
        name === 'top-five'
          ? '.home-five'
          : name === 'pulse'
            ? '.weekly-cinema-pulse'
            : name === 'collections'
              ? '.collection-shelf'
              : '.world-results';
      await page
        .locator(section)
        .first()
        .screenshot({
          path: `/tmp/mm-design-screenshots/${name}-${theme}.png`,
          ...capture,
        });
      await page.setViewportSize({ width: 390, height: 844 });
      await page
        .locator(section)
        .first()
        .screenshot({
          path: `/tmp/mm-design-screenshots/${name}-${theme}-mobile.png`,
          ...capture,
        });
      if (name === 'collections')
        assert.equal(
          await page
            .locator('.collection-shelf')
            .first()
            .evaluate((el) => getComputedStyle(el).color),
          await page.evaluate(() => getComputedStyle(document.body).color),
        );
      if (name === 'top-five')
        assert.equal(
          await page
            .locator('.home-five-number')
            .first()
            .evaluate((el) => getComputedStyle(el).fontSize),
          '12px',
        );
    }
  }
  // The common primitive must reset its fallback when data supplies a new source; failure is not a broken-image icon.
  await open('/catalog?studio=' + studio);
  const broken = page
    .locator('.film-card')
    .filter({ hasText: 'Единый дизайн 5' });
  await broken.locator('[data-poster-state="fallback"]').waitFor();
  await db.query('update mg_movies set poster=$1 where id=$2', [
    '/brand/moviemovie-logo.png',
    ids[5],
  ]);
  await page.reload();
  await broken.locator('[data-poster-state="image"] img').waitFor();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(
    await broken.evaluate((el) => getComputedStyle(el).transitionDuration),
    '0s',
  );
  await page.emulateMedia({ forcedColors: 'active' });
  await broken.focus();
  assert.equal(
    await broken.evaluate((el) => getComputedStyle(el).outlineStyle),
    'solid',
  );
  assert.deepEqual(errors, []);
  console.log(
    'Passed shared catalog design contract: radius/background/poster ratio/Rubik title/metadata/rating badge parity on catalog, pulse, top-five, collections and atlas; both themes, 8 widths, readable themed shelves, compact ranks, real broken-poster fallback/recovery, reduced motion and forced colors. Screenshots /tmp/mm-design-screenshots',
  );
} finally {
  await browser.close();
  if (ids.length) {
    for (const table of ['mg_favorites', 'mg_watches', 'mg_ratings'])
      await db.query(`delete from ${table} where movie_id=any($1::int[])`, [
        ids,
      ]);
    await db.query('delete from mg_movies where id=any($1::int[])', [ids]);
  }
  if (userId) await db.query('delete from mg_users where id=$1', [userId]);
  await db.end();
}
