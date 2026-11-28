// Real production pages + disposable local SQL only. No production mutations.
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
  films = [];
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    }),
    peerContext = await browser.newContext(),
    page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await context.addInitScript(() =>
    localStorage.setItem('mg_season_mode', 'off'),
  );
  const stamp = Date.now();
  const peerName = 'ИмяБезПробелов' + String(stamp).slice(-10);
  async function signup(ctx, name) {
    const response = await ctx.request.post(base + '/api/auth', {
      data: {
        action: 'register',
        email: `${name}-${stamp}@example.test`,
        username: name + stamp,
        password: 'responsive-profile-test-password',
      },
    });
    assert.equal(response.status(), 200);
    const id = (await response.json()).user.id;
    users.push(id);
    return id;
  }
  const me = await signup(context, 'Reader'),
    peer = await signup(peerContext, 'Friend');
  await db.query(
    'update mg_users set username=$1,bio=$2,xp=6715,header_style=1 where id=$3',
    [peerName, 'ДлиннаяБиография'.repeat(6), peer],
  );
  for (let n = 0; n < 9; n++) {
    const id = (
      await db.query(
        "insert into mg_movies(title,description,category,genre,studio,year,duration,episodes,poster)values($1,'Responsive fixture','Сериал','Фэнтези, Драма',$2,2024,48,500,'/brand/moviemovie-logo.png')returning id",
        ['Длинное название истории ' + n, 'Responsive' + stamp],
      )
    ).rows[0].id;
    films.push(id);
    await db.query(
      "insert into mg_watches(user_id,movie_id,watched_at)values($1,$3,now()-$4::int*interval '1 day'),($2,$3,now()-$4::int*interval '1 day')",
      [me, peer, id, n],
    );
    await db.query(
      'insert into mg_ratings(user_id,movie_id,value)values($1,$2,9)',
      [peer, id],
    );
  }
  await db.query(
    "insert into mg_friendships(from_id,to_id,status)values($1,$2,'accepted')",
    [me, peer],
  );
  fs.mkdirSync('/tmp/mm-profile-responsive-screenshots', { recursive: true });
  const open = async (path) => {
    await page.goto(base + path);
    // Wait for session/relationship hydration before testing manual profile retry.
    await page.locator('.app-shell[data-hud-busy="false"]').waitFor();
  };
  await open('/challenges');
  await page.locator('.challenge-month-tab').last().waitFor();
  for (const theme of ['Тёмная', 'Светлая']) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await chooseTheme(page, theme);
    for (const width of [
      320, 360, 390, 600, 760, 900, 1024, 1182, 1280, 1440, 1920,
    ]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(
        await page.locator('.challenge-month-tab:visible').count(),
        12,
      );
      const clipped = await page.locator('.challenge-month-tabs').evaluate(
        (el) =>
          [...el.children].filter((child) => {
            const r = child.getBoundingClientRect(),
              p = el.getBoundingClientRect();
            return (
              r.left < p.left - 1 ||
              r.right > p.right + 1 ||
              r.right > innerWidth ||
              r.left < 0
            );
          }).length,
      );
      assert.equal(clipped, 0, `Clipped months ${theme}/${width}`);
    }
  }
  await page.getByRole('button', { name: /12 Декабрь/ }).click();
  assert.equal(
    await page
      .getByRole('button', { name: /12 Декабрь/ })
      .getAttribute('aria-pressed'),
    'true',
  );
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.locator('.challenge-month-tabs').screenshot({
    path: '/tmp/mm-profile-responsive-screenshots/months-mobile.png',
  });
  await open('/user/' + peer);
  await page.locator('.public-profile .expanded-stats').waitFor();
  let snapshot = await (
    await context.request.get(base + '/api/profile?id=' + peer)
  ).json();
  assert.equal(snapshot.commonFilms, 9);
  assert.equal(snapshot.recentWatches.length, 6);
  assert.equal(snapshot.stats.totalMinutes, 9 * 48 * 500);
  assert.match(await page.locator('.common-count').innerText(), /9/);
  for (const theme of ['Тёмная', 'Светлая']) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await chooseTheme(page, theme);
    for (const width of [
      320, 360, 390, 600, 760, 900, 1024, 1182, 1280, 1440, 1920,
    ]) {
      await page.setViewportSize({ width, height: 1000 });
      const issues = await page.locator('.public-profile').evaluate((root) => {
        const issues = [];
        if (document.documentElement.scrollWidth > innerWidth + 1)
          issues.push('document overflow');
        for (const el of root.querySelectorAll(
          '.expanded-stats>div,.expanded-stats b,.cover-identity,.cover-actions button,.history-list button,.category-bars',
        )) {
          const r = el.getBoundingClientRect(),
            panel = el
              .closest('.profile-tile,.profile-cover')
              ?.getBoundingClientRect();
          if (r.width < 1 || r.left < 0 || r.right > innerWidth + 1)
            issues.push('offscreen ' + el.className);
          if (
            panel &&
            (r.left < panel.left - 1 ||
              r.right > panel.right + 1 ||
              r.top < panel.top - 1 ||
              r.bottom > panel.bottom + 1)
          )
            issues.push('outside panel ' + el.className);
          if (el.matches('b') && el.scrollWidth > el.clientWidth + 1)
            issues.push('clipped value ' + el.textContent);
        }
        return issues;
      });
      assert.deepEqual(issues, [], `Friend profile ${theme}/${width}`);
      if ([390, 1182, 1440].includes(width))
        await page.screenshot({
          path: `/tmp/mm-profile-responsive-screenshots/profile-${theme}-${width}.png`,
          fullPage: true,
          animations: 'disabled',
        });
    }
  }
  // Every existing cover skin keeps its content inside, not just the default skin.
  assert.equal(
    await page
      .locator('.content')
      .evaluate((el) => getComputedStyle(el).maxWidth),
    '1720px',
  );
  for (const style of [2, 3, 4, 5]) {
    await db.query('update mg_users set header_style=$1 where id=$2', [
      style,
      peer,
    ]);
    await page.reload();
    await page
      .locator(`.public-profile .profile-cover[data-style="${style}"]`)
      .waitFor();
    for (const width of [320, 760, 1182]) {
      await page.setViewportSize({ width, height: 1000 });
      const clipped = await page
        .locator('.public-profile .profile-cover')
        .evaluate((el) => {
          const p = el.getBoundingClientRect();
          return [
            ...el.querySelectorAll(
              '.cover-identity,.cover-actions button,.profile-cover-content>.avatar',
            ),
          ].some((child) => {
            const r = child.getBoundingClientRect();
            return (
              r.left < p.left - 1 ||
              r.right > p.right + 1 ||
              r.top < p.top - 1 ||
              r.bottom > p.bottom + 1
            );
          });
        });
      assert(!clipped, `Cover skin ${style} clipped at ${width}`);
    }
  }
  // All real catalog cards remain available, including the fifth on mobile.
  await open('/catalog?studio=Responsive' + stamp);
  await page.locator('.film-card').last().waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('.film-card:visible').count(), 9);
  // Pending directions are meaningful and changes refresh this same profile.
  await db.query(
    'delete from mg_friendships where from_id=any($1::int[]) or to_id=any($1::int[])',
    [users],
  );
  await open('/user/' + peer);
  await page
    .getByRole('button', { name: 'Добавить в друзья', exact: true })
    .waitFor();
  await page.route('**/api/action', async (route) => {
    if (route.request().postDataJSON()?.action === 'friend')
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Test save failure' }),
      });
    else await route.continue();
  });
  await page
    .getByRole('button', { name: 'Добавить в друзья', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Добавить в друзья', exact: true })
    .waitFor({ state: 'visible' });
  await page.waitForFunction(
    () =>
      !document.querySelector('.public-profile .cover-actions button')
        ?.disabled,
  );
  await page.unroute('**/api/action');
  await page
    .getByRole('button', { name: 'Добавить в друзья', exact: true })
    .click();
  await page.getByText('⏳ Заявка отправлена', { exact: true }).waitFor();
  snapshot = await (
    await context.request.get(base + '/api/profile?id=' + peer)
  ).json();
  assert.equal(snapshot.friendship.direction, 'outgoing');
  await db.query(
    'update mg_friendships set from_id=$1,to_id=$2 where from_id=$2 and to_id=$1',
    [peer, me],
  );
  await page.reload();
  await page
    .getByRole('button', { name: 'Принять заявку', exact: true })
    .click();
  await page.getByRole('button', { name: 'Написать', exact: true }).waitFor();
  snapshot = await (
    await context.request.get(base + '/api/profile?id=' + peer)
  ).json();
  assert.equal(snapshot.friendship.status, 'accepted');
  await page.getByRole('button', { name: 'Написать', exact: true }).click();
  await page.locator('.chat-drawer').waitFor();
  // Navigate from a settled friends snapshot so initial session hydration cannot
  // issue a second legitimate profile fetch while testing the manual retry.
  await open('/friends');
  const friendCard = page
    .locator('.person-card')
    .filter({ hasText: peerName });
  await friendCard
    .getByRole('button', { name: 'Профиль', exact: true })
    .waitFor();
  await page.route('**/api/profile?id=' + peer, (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"error":"temporary"}',
    }),
  );
  await friendCard
    .getByRole('button', { name: 'Профиль', exact: true })
    .click();
  await page.getByRole('button', { name: 'Повторить', exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole('heading', { name: 'Пользователь не найден', exact: true })
      .count(),
    0,
  );
  await page.unroute('**/api/profile?id=' + peer);
  await page
    .getByRole('button', { name: 'Повторить', exact: true })
    .evaluate((button) => button.click());
  await page.locator('.public-profile').waitFor();
  assert.deepEqual(errors, []);
  console.log(
    'Passed public profile and responsive content: 12 fully visible months, all catalog cards including fifth, large statistics and long identity in 11 widths/two themes, full-history common count, outgoing/incoming/accepted requests with live refresh/failure retry, chat, transient profile recovery. Screenshots /tmp/mm-profile-responsive-screenshots',
  );
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
  }
  if (films.length) {
    for (const table of ['mg_ratings', 'mg_watches'])
      await db.query(`delete from ${table} where movie_id=any($1::int[])`, [
        films,
      ]);
    await db.query('delete from mg_movies where id=any($1::int[])', [films]);
  }
  if (users.length)
    await db.query('delete from mg_users where id=any($1::int[])', [users]);
  await db.end();
}
