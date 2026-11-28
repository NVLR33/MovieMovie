// Owned-collection UX on the actual production app. All writes are isolated/local.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { Client } from 'pg';
import { assertMaterialCovers } from './material-cover-contract.mjs';
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
const ids = [],
  users = [],
  shots = '/tmp/mm-personal-screenshots';
await mkdir(shots, { recursive: true });
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    }),
    peer = await browser.newContext(),
    stamp = Date.now();
  await context.addInitScript(() => {
    localStorage.setItem('mg_season_mode', 'off');
    localStorage.setItem('mg_ambient_canvas', 'false');
    localStorage.setItem('mg_memory_view', 'list');
  });
  async function signup(ctx, name) {
    const response = await ctx.request.post(base + '/api/auth', {
      data: {
        action: 'register',
        email: `personal-${name}-${stamp}@example.test`,
        username: name + stamp,
        password: 'isolated-personal-cinema-password',
      },
    });
    assert.equal(response.status(), 200);
    const user = (await response.json()).user;
    users.push(user.id);
    return user;
  }
  const user = await signup(context, 'Shelf'),
    other = await signup(peer, 'Peer');
  const defs = [
    ['Альфа', 'Фильм', 2023],
    ['Бета', 'Сериал', 2024],
    ['Гамма', 'Аниме-фильм', 2020],
    ['Дельта', 'Фильм', 2025],
    ['Чужая история', 'Фильм', 2026],
  ];
  for (const [name, category, year] of defs)
    ids.push(
      (
        await db.query(
          "insert into mg_movies(title,description,category,genre,year,duration,poster,backdrop)values($1,$2,$3,'Драма, Фантастика',$4,100,'/brand/moviemovie-logo.png','/brand/moviemovie-logo.png')returning id",
          [
            name + ' ' + stamp,
            'Личная история о том, что остаётся с нами после финальных титров. '.repeat(
              4,
            ),
            category,
            year,
          ],
        )
      ).rows[0].id,
    );
  for (const id of ids.slice(0, 4))
    await db.query('insert into mg_favorites(user_id,movie_id)values($1,$2)', [
      user.id,
      id,
    ]);
  for (const id of [ids[1], ids[3]])
    await db.query('insert into mg_bookmarks(user_id,movie_id)values($1,$2)', [
      user.id,
      id,
    ]);
  for (const id of [ids[0], ids[2]])
    await db.query('insert into mg_watches(user_id,movie_id)values($1,$2)', [
      user.id,
      id,
    ]);
  await db.query(
    'insert into mg_ratings(user_id,movie_id,value)values($1,$2,8.5),($1,$3,9.5)',
    [user.id, ids[0], ids[2]],
  );
  await db.query('insert into mg_bookmarks(user_id,movie_id)values($1,$2)', [
    other.id,
    ids[1],
  ]);
  await db.query('insert into mg_favorites(user_id,movie_id)values($1,$2)', [
    other.id,
    ids[1],
  ]);
  await db.query('update mg_users set username=$1,bio=$2 where id=$3', [
    'ИмяБезПробелов' + String(stamp).slice(-10),
    'Личный кинодневник. '.repeat(4),
    user.id,
  ]);
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const load = async (path) => {
    await page.goto(base + path);
    await page.waitForFunction(
      () =>
        document.querySelector('.app-shell')?.getAttribute('data-hud-busy') ===
        'false',
    );
  };
  const titles = async () =>
    page.locator('.personal-library-desk .film-card h3').allTextContents();
  const count = async (n) =>
    page.waitForFunction(
      (n) =>
        document.querySelectorAll('.personal-library-desk .film-card')
          .length === n,
      n,
    );
  await load('/favorites');
  await count(4);
  assert.equal(
    await page
      .locator('.personal-collection-nav a[aria-current]')
      .getAttribute('href'),
    '/favorites',
  );
  assert(
    !(await titles()).some((t) => t.includes('Чужая')),
    'No unowned title enters a personal shelf',
  );
  const query = page.getByRole('textbox', {
    name: 'Поиск в коллекции',
    exact: true,
  });
  await query.fill('Гамма');
  await count(1);
  assert.match(
    await page.locator('.personal-evening h2').innerText(),
    /^Гамма/,
  );
  await page
    .getByRole('combobox', { name: 'Формат коллекции', exact: true })
    .selectOption('Фильм');
  await count(0);
  assert.equal(await page.locator('.personal-evening-cover').count(), 0);
  assert.equal(
    await page.locator('.personal-evening-empty a[href="/catalog"]').count(),
    0,
    'No unrelated catalog fallback for an empty filtered shelf',
  );
  await page
    .getByRole('button', { name: 'Показать всю коллекцию', exact: true })
    .click();
  await count(4);
  await page
    .getByRole('combobox', { name: 'Оценка в коллекции', exact: true })
    .selectOption('rated');
  await count(2);
  await page
    .getByRole('combobox', { name: 'Порядок коллекции', exact: true })
    .selectOption('mine');
  assert.match((await titles())[0], /^Гамма/);
  await page
    .getByRole('combobox', { name: 'Просмотр в коллекции', exact: true })
    .selectOption('unwatched');
  await count(0);
  await page
    .getByRole('button', { name: 'Показать всю коллекцию', exact: true })
    .click();
  await count(4);
  await page
    .getByRole('combobox', { name: 'Порядок коллекции', exact: true })
    .selectOption('year');
  assert.match((await titles())[0], /^Дельта/);
  const first = await page.locator('.personal-evening h2').innerText();
  await page
    .getByRole('button', { name: 'Следующая сохранённая история', exact: true })
    .click();
  assert.notEqual(
    await page.locator('.personal-evening h2').innerText(),
    first,
  );
  const quick = page.locator('dialog.movie-quick-view'),
    entry = page.locator('.personal-evening-story a');
  await entry.focus();
  const y = await page.evaluate(() => scrollY),
    url = page.url();
  await page.keyboard.press('Enter');
  await quick.waitFor();
  await page.keyboard.press('Escape');
  await quick.waitFor({ state: 'detached' });
  await page.waitForFunction((y) => Math.abs(scrollY - y) < 3, y);
  assert.equal(page.url(), url);
  assert(await entry.evaluate((e) => e === document.activeElement));
  assert.equal(
    await page
      .getByRole('combobox', { name: 'Порядок коллекции', exact: true })
      .inputValue(),
    'year',
  );
  // Real removal updates both shelves and profile, without touching another user's collection.
  await load('/watchlist');
  await count(2);
  const card = page.locator('.personal-library-desk .film-card').filter({
    has: page.getByRole('heading', { name: 'Бета ' + stamp, exact: true }),
  });
  await card.focus();
  await page.keyboard.press('Enter');
  await quick.waitFor();
  await quick.locator('.quick-save').click();
  await page.waitForFunction(
    () =>
      document.querySelector('.quick-save')?.getAttribute('aria-pressed') ===
        'false' && !document.querySelector('.quick-save')?.disabled,
  );
  await page.keyboard.press('Escape');
  await quick.waitFor({ state: 'detached' });
  await count(1);
  assert(
    await page
      .locator('#main-content')
      .evaluate((e) => e === document.activeElement),
    'Removed trigger restores focus to the main content',
  );
  assert.equal(
    (
      await db.query(
        'select count(*)::int n from mg_bookmarks where user_id=$1 and movie_id=$2',
        [user.id, ids[1]],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await db.query(
        'select count(*)::int n from mg_bookmarks where user_id=$1 and movie_id=$2',
        [other.id, ids[1]],
      )
    ).rows[0].n,
    1,
  );
  await load('/favorites');
  await count(4);
  await page
    .locator('.personal-library-desk .film-card')
    .filter({
      has: page.getByRole('heading', { name: 'Бета ' + stamp, exact: true }),
    })
    .click();
  await quick.waitFor();
  await quick.locator('.quick-favorite').click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('.quick-favorite')
        ?.getAttribute('aria-pressed') === 'false' &&
      !document.querySelector('.quick-favorite')?.disabled,
  );
  await page.keyboard.press('Escape');
  await count(3);
  assert.equal(
    (
      await db.query(
        'select count(*)::int n from mg_favorites where user_id=$1 and movie_id=$2',
        [other.id, ids[1]],
      )
    ).rows[0].n,
    1,
  );
  await page.locator('.personal-library-desk .film-card').first().click();
  await quick.waitFor();
  await context.route('**/api/action', (r) =>
    r.fulfill({
      status: 500,
      json: { error: 'Intentional collection failure' },
    }),
  );
  await quick.locator('.quick-favorite').click();
  await quick.getByRole('alert').waitFor();
  await page.waitForFunction(
    () =>
      document
        .querySelector('.quick-favorite')
        ?.getAttribute('aria-pressed') === 'true' &&
      !document.querySelector('.quick-favorite')?.disabled,
  );
  await context.unroute('**/api/action');
  await page.keyboard.press('Escape');
  await count(3);
  await load('/profile');
  assert.match(
    await page
      .locator('.personal-profile-stage .personal-evening h2')
      .innerText(),
    /^Дельта/,
  );
  await page
    .getByRole('button', { name: 'Настроить профиль', exact: true })
    .click();
  await page.locator('.customize-panel').waitFor();
  await page
    .locator('.customize-panel textarea')
    .fill('Сохранённое описание профиля');
  const posted = page.waitForResponse(
    (r) => r.url().endsWith('/api/action') && r.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Сохранить текст', exact: true })
    .click();
  assert.equal((await posted).status(), 200);
  await page.waitForFunction(
    () =>
      document.querySelector('.cover-main > p')?.textContent ===
      'Сохранённое описание профиля',
  );
  assert.equal(
    (await db.query('select bio from mg_users where id=$1', [user.id])).rows[0]
      .bio,
    'Сохранённое описание профиля',
  );
  await page.getByRole('button', { name: 'Готово', exact: true }).click();
  // Composition matrix: preserve full responsive controls, unique h1 and cover ownership.
  for (const theme of ['dark', 'light', 'pink', 'purple', 'yellow'])
    for (const path of ['/profile', '/watchlist', '/favorites']) {
      await load(path);
      await page.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      for (const width of [320, 390, 600, 760, 800, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.waitForTimeout(100);
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${theme}/${path}/${width} document overflow`,
        );
        assert.equal(await page.locator('main h1').count(), 1);
        if (path === '/profile') {
          const { cover, next } = await page
            .locator('.personal-profile-stage')
            .evaluate((el) => ({
              cover: el
                .querySelector('.profile-cover')
                .getBoundingClientRect()
                .toJSON(),
              next: el
                .querySelector('.personal-evening')
                .getBoundingClientRect()
                .toJSON(),
            }));
          if (width > 800)
            assert(
              cover.x + cover.width < next.x && Math.abs(cover.y - next.y) < 2,
              `${width} personal stage split`,
            );
          else
            assert(next.y >= cover.y + cover.height, `${width} stage stacked`);
          const clipped = await page
            .locator('.personal-profile .profile-cover')
            .evaluate((el) => {
              const b = el.getBoundingClientRect();
              return [
                ...el.querySelectorAll(
                  '.profile-name,.cover-side,.cover-main,.cover-edit',
                ),
              ].some((c) => {
                const r = c.getBoundingClientRect();
                return (
                  r.x < b.x - 1 ||
                  r.right > b.right + 1 ||
                  r.y < b.y - 1 ||
                  r.bottom > b.bottom + 1
                );
              });
            });
          assert(!clipped, `${theme}/${width} identity clipping`);
          for (const id of [
            'personal-atlas',
            'personal-activity',
            'personal-journal',
          ]) {
            await page
              .locator(`.personal-diary-chapters a[href="#${id}"]`)
              .click();
            assert(
              await page
                .locator('#' + id)
                .evaluate((el) => el === document.activeElement),
            );
          }
        } else {
          for (const field of await page
            .locator('.personal-library-controls select')
            .all()) {
            const b = await field.boundingBox();
            assert(
              b.x >= 0 && b.x + b.width <= width + 1 && b.height >= 42,
              `${theme}/${width} collection controls`,
            );
          }
        }
        await assertMaterialCovers(
          page,
          path === '/profile' ? '.personal-profile-stage' : '.personal-library',
        );
        if (['dark', 'light'].includes(theme) && [390, 1440].includes(width)) {
          await page.evaluate(() => scrollTo(0, 0));
          await page.screenshot({
            path: `${shots}/${path.slice(1)}-${theme}-${width}.png`,
          });
        }
      }
    }
  // Existing profile subspaces remain reachable and do not pile up behind the diary.
  await load('/profile');
  await page.getByRole('button', { name: 'Титулы', exact: true }).click();
  assert.equal(await page.locator('.cinema-passport').count(), 0);
  await page.getByRole('button', { name: 'Кинодневник', exact: true }).click();
  await page.locator('.cinema-passport').waitFor();
  for (const style of [1, 2, 3, 4, 5]) {
    await page
      .locator('.personal-profile .profile-cover')
      .evaluate((el, value) => (el.dataset.style = String(value)), style);
    for (const width of [320, 760, 1182, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(100);
      assert(
        await page
          .locator('.personal-profile .profile-cover')
          .evaluate((el) => {
            const box = el.getBoundingClientRect();
            return [
              ...el.querySelectorAll(
                '.cover-main,.cover-side,.profile-name,.cover-edit',
              ),
            ].every((child) => {
              const r = child.getBoundingClientRect();
              return (
                r.left >= box.left - 1 &&
                r.right <= box.right + 1 &&
                r.top >= box.top - 1 &&
                r.bottom <= box.bottom + 1
              );
            });
          }),
        `Owned cover skin ${style}/${width}`,
      );
    }
  }
  // An actually empty member shelf is distinct from a filtered-empty collection.
  for (const table of ['mg_bookmarks', 'mg_favorites'])
    await db.query(`delete from ${table} where user_id=$1`, [other.id]);
  await peer.addInitScript(() => {
    localStorage.setItem('mg_lang', 'en');
    localStorage.setItem('mg_season_mode', 'off');
  });
  const emptyPage = await peer.newPage();
  for (const path of ['/watchlist', '/favorites']) {
    await emptyPage.goto(base + path);
    await emptyPage.locator('.personal-library-desk .empty-state').waitFor();
    assert.equal(
      await emptyPage.locator('.film-card,.personal-evening-cover').count(),
      0,
    );
    await emptyPage
      .getByRole('textbox', { name: 'Search your collection', exact: true })
      .waitFor();
    assert.equal(
      await emptyPage
        .getByRole('combobox', { name: 'Collection format', exact: true })
        .locator('option[value="Аниме-фильм"]')
        .innerText(),
      'Anime films',
    );
  }
  assert.equal(
    (
      await db.query(
        'select count(*)::int n from mg_watches where user_id=$1',
        [user.id],
      )
    ).rows[0].n,
    2,
    'Browsing must not mark new watches',
  );
  // Guest gates must never reveal a previous member's shelf.
  const guest = await browser.newContext({ reducedMotion: 'reduce' }),
    g = await guest.newPage();
  for (const path of ['/profile', '/watchlist', '/favorites']) {
    await g.goto(base + path);
    await g
      .getByRole('button', {
        name: 'Войти или зарегистрироваться',
        exact: true,
      })
      .waitFor();
    assert.equal(
      await g.locator('.personal-library,.personal-profile').count(),
      0,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    'PASS personal cinema: owned shelves/query/format/watch/my-rating/sorts/empty reset; filtered manual spotlight; quick-view state/focus and removed-trigger fallback; real ownership-safe removal + failed-action rollback; saved profile text/subspaces; five themes × eight widths × three pages; no automatic watches; all five owned cover skins; actual empty shelves/English; guest gates.',
  );
  await guest.close();
  await peer.close();
  await context.close();
} finally {
  for (const table of [
    'mg_bookmarks',
    'mg_favorites',
    'mg_ratings',
    'mg_watches',
  ])
    await db.query(`delete from ${table} where user_id=any($1::int[])`, [
      users,
    ]);
  if (ids.length)
    await db.query('delete from mg_movies where id=any($1::int[])', [ids]);
  await browser.close();
  await db.end();
}
