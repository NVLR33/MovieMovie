// Real production pages and friendship actions, exclusively on the disposable marker-guarded DB.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
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
const users = [],
  films = [],
  shots = '/tmp/mm-community-cinema-screenshots';
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
  });
  async function signup(ctx, name) {
    const r = await ctx.request.post(base + '/api/auth', {
      data: {
        action: 'register',
        email: `community-${name}-${stamp}@example.test`,
        username: name + stamp,
        password: 'isolated-community-cinema-password',
      },
    });
    assert.equal(r.status(), 200);
    const u = (await r.json()).user;
    users.push(u.id);
    return u;
  }
  const me = await signup(context, 'Com'),
    a = await signup(peer, 'Circle'),
    b = await signup(peer, 'Incoming'),
    c = await signup(peer, 'Outgoing'),
    d = await signup(peer, 'New');
  await db.query('update mg_users set username=$1,bio=$2,xp=6715 where id=$3', [
    'ЗрительБезПробелов' + String(stamp).slice(-7),
    'Длинная биография о любимых историях. '.repeat(5),
    a.id,
  ]);
  a.username = 'ЗрительБезПробелов' + String(stamp).slice(-7);
  await db.query(
    "insert into mg_friendships(from_id,to_id,status)values($1,$2,'accepted'),($3,$1,'pending'),($1,$4,'pending')",
    [me.id, a.id, b.id, c.id],
  );
  const film = (
    await db.query(
      "insert into mg_movies(title,description,category,genre,year,duration,poster)values($1,'Community fixture','Фильм','Драма',2024,120,'/brand/moviemovie-logo.png')returning id",
      ['Кино-связь ' + stamp],
    )
  ).rows[0].id;
  films.push(film);
  await db.query(
    'insert into mg_watches(user_id,movie_id)values($1,$3),($2,$3)',
    [me.id, a.id, film],
  );
  await db.query(
    'insert into mg_ratings(user_id,movie_id,value)values($1,$2,8)',
    [a.id, film],
  );
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const load = async (path) => {
    await page.goto(base + path);
    await page.locator('.community-cinema').waitFor();
    await page.waitForFunction(
      () => document.documentElement.dataset.hudBusy !== 'true',
    );
  };
  const card = (name) =>
    page.locator('.community-directory .person-card').filter({ hasText: name });
  const scope = (name) =>
    page
      .getByRole('group', { name: 'Круг общения' })
      .getByRole('button', { name: new RegExp('^' + name) });
  const search = page.getByRole('textbox', {
    name: 'Найти зрителя',
    exact: true,
  });
  await load('/friends');
  assert.equal(await card(me.username).count(), 0);
  await scope('Друзья').click();
  assert.equal(await page.locator('.person-card').count(), 1);
  await card(a.username)
    .getByRole('button', { name: 'Чат', exact: true })
    .waitFor();
  await scope('Входящие').click();
  assert.equal(await page.locator('.person-card').count(), 1);
  await search.fill('НЕСУЩЕСТВУЮЩИЙ');
  await page
    .getByRole('heading', { name: 'Никого не нашли', exact: true })
    .waitFor();
  await page
    .getByRole('button', { name: 'Показать всех зрителей', exact: true })
    .click();
  await search.fill('  ' + a.username.toUpperCase() + '  ');
  assert.equal(await page.locator('.person-card').count(), 1);
  await page
    .getByRole('button', { name: 'Очистить поиск зрителей', exact: true })
    .click();
  await scope('Исходящие').click();
  await card(c.username)
    .getByText('Заявка отправлена', { exact: true })
    .waitFor();
  assert.equal(
    await card(c.username)
      .getByRole('button', { name: 'Добавить', exact: true })
      .count(),
    0,
  );
  // A failed action leaves the relation unchanged and has a local retryable error.
  await scope('Все зрители').click();
  await context.route('**/api/action', (r) => {
    const body = r.request().postDataJSON();
    return body.action === 'friend' && body.userId === d.id
      ? r.fulfill({ status: 503, json: { error: 'temporary' } })
      : r.continue();
  });
  await card(d.username)
    .getByRole('button', { name: 'Добавить', exact: true })
    .click();
  await page.locator('.community-action-error').waitFor();
  assert.equal(
    (
      await db.query(
        'select count(*)::int n from mg_friendships where from_id=$1 and to_id=$2',
        [me.id, d.id],
      )
    ).rows[0].n,
    0,
  );
  await context.unroute('**/api/action');
  await card(d.username)
    .getByRole('button', { name: 'Добавить', exact: true })
    .click();
  await card(d.username)
    .getByText('Заявка отправлена', { exact: true })
    .waitFor();
  await scope('Входящие').click();
  await card(b.username)
    .getByRole('button', { name: 'Принять', exact: true })
    .click();
  await page
    .getByRole('heading', { name: 'Новых заявок нет', exact: true })
    .waitFor();
  assert.equal(
    (
      await db.query(
        'select status from mg_friendships where from_id=$1 and to_id=$2',
        [b.id, me.id],
      )
    ).rows[0].status,
    'accepted',
  );
  await scope('Друзья').click();
  await card(a.username)
    .getByRole('button', { name: 'Чат', exact: true })
    .click();
  await page.locator('.chat-drawer').waitFor();
  await load('/friends');
  await card(a.username)
    .getByRole('button', { name: 'Профиль', exact: true })
    .click();
  await page.locator('.community-profile-connection').waitFor();
  assert.match(await page.locator('.common-count').innerText(), /1/);
  await page
    .getByRole('button', { name: 'Сравнить вкусы', exact: true })
    .click();
  await page.waitForURL('**/compare/' + a.id);
  await load('/leaderboard');
  const snapshot = await (await context.request.get(base + '/api/data')).json();
  for (const metric of [
    'Часы просмотра',
    'Просмотры',
    'Активные дни',
    'Опыт XP',
    'Оценки',
    'Игровые очки',
  ]) {
    const btn = page
      .getByRole('group', { name: 'Показатель рейтинга' })
      .getByRole('button', { name: metric, exact: true });
    await btn.click();
    assert.equal(await btn.getAttribute('aria-pressed'), 'true');
    assert.match(
      await page.locator('.community-ranking-spotlight .eyebrow').innerText(),
      new RegExp(metric, 'i'),
    );
  }
  for (const size of [1, 3, 5, 10, 25, 50, 100]) {
    await page
      .getByRole('button', { name: 'Топ-' + size, exact: true })
      .click();
    assert.equal(
      await page.locator('.leaderboard-rank-list .rank-row').count(),
      Math.min(size, snapshot.leaderboard.length),
    );
  }
  await page.locator('.community-rank-name').first().click();
  await page.locator('.public-profile').waitFor();
  // Deterministic mock snapshots only for sparse ranking and directory empty states.
  await context.route('**/api/data', (r) =>
    r.fulfill({
      json: {
        ...snapshot,
        leaderboard: [],
        people: [snapshot.user],
        friends: [],
      },
    }),
  );
  await load('/leaderboard');
  await page
    .getByRole('heading', { name: 'Рейтинг пока пуст', exact: true })
    .waitFor();
  assert.equal(await page.locator('.podium-person').count(), 0);
  await load('/friends');
  await page
    .getByRole('heading', { name: 'Пока здесь только ты', exact: true })
    .waitFor();
  await context.unroute('**/api/data');
  // Five palette families; geometry is read atomically, not across scroll/focus changes.
  for (const theme of ['dark', 'light', 'pink', 'purple', 'yellow']) {
    await page.evaluate(
      (theme) => localStorage.setItem('mg_theme', theme),
      theme,
    );
    for (const path of ['/friends', '/leaderboard', '/user/' + a.id]) {
      await load(path);
      for (const width of [320, 390, 600, 760, 900, 1182, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => {
          document.activeElement?.blur();
          scrollTo(0, 0);
        });
        await page.waitForTimeout(110);
        const issues = await page
          .locator('.community-cinema')
          .evaluate((root) => {
            const out = [];
            if (document.documentElement.scrollWidth > innerWidth + 1)
              out.push('page overflow');
            for (const el of root.querySelectorAll(
              '.person-card,.community-invitation,.community-ranking-spotlight,.community-directory-tools,.rank-row,.podium-person,.profile-tile,.profile-cover,.cover-identity,.cover-actions button',
            )) {
              const r = el.getBoundingClientRect();
              if (r.width < 1 || r.left < 0 || r.right > innerWidth + 1)
                out.push(
                  el.className +
                    ' outside viewport ' +
                    JSON.stringify({
                      left: r.left,
                      right: r.right,
                      width: r.width,
                    }),
                );
              if (el.scrollWidth > el.clientWidth + 2)
                out.push(el.className + ' internal overflow');
            }
            return out;
          });
        assert.deepEqual(issues, [], `${theme}/${width}/${path}`);
        assert.equal(await page.locator('.community-cinema h1').count(), 1);
        if (['dark', 'light'].includes(theme) && [390, 1440].includes(width))
          await page.screenshot({
            path: `${shots}/${path.startsWith('/user') ? 'profile' : path.slice(1)}-${theme}-${width}.png`,
            fullPage: false,
          });
      }
    }
  }
  const guest = await browser.newContext(),
    g = await guest.newPage();
  await g.goto(base + '/friends');
  await g
    .getByRole('button', { name: 'Войти или зарегистрироваться', exact: true })
    .waitFor();
  assert.equal(await g.locator('.community-directory').count(), 0);
  await g.goto(base + '/leaderboard');
  await g.locator('.community-leaderboard').waitFor();
  await g.goto(base + '/user/' + a.id);
  await g.locator('.public-profile').waitFor();
  assert.equal(await g.locator('.common-films-tile').count(), 0);
  await g
    .locator('.cover-actions')
    .getByRole('button', { name: 'Войти', exact: true })
    .click();
  await g.locator('.auth-modal').waitFor();
  assert.deepEqual(errors, []);
  assert.equal(
    (
      await db.query(
        'select count(*)::int n from mg_watches where user_id=$1',
        [me.id],
      )
    ).rows[0].n,
    1,
    'Community browsing never records watches',
  );
  console.log(
    'PASS community cinema: real scoped directory/search/reset; incoming/outgoing/accepted relationships; real send/accept and failed-request retry; chat/profile/comparison; six ranking metrics/seven limits/profile links and empty states; guest permissions; five themes × eight widths × three pages; no automatic watches.',
  );
  await guest.close();
  await peer.close();
  await context.close();
} finally {
  await browser.close();
  if (users.length) {
    await db.query(
      'delete from mg_notifications where user_id=any($1::int[]) or actor_id=any($1::int[])',
      [users],
    );
    await db.query(
      'delete from mg_friendships where from_id=any($1::int[]) or to_id=any($1::int[])',
      [users],
    );
    for (const table of ['mg_ratings', 'mg_watches'])
      await db.query(`delete from ${table} where user_id=any($1::int[])`, [
        users,
      ]);
    await db.query('delete from mg_users where id=any($1::int[])', [users]);
  }
  if (films.length)
    await db.query('delete from mg_movies where id=any($1::int[])', [films]);
  await db.end();
}
