// Marker-guarded real local DB + production Next app. Never production writes.
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
  shots = '/tmp/mm-conversations-screenshots';
await mkdir(shots, { recursive: true });
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    }),
    other = await browser.newContext(),
    stamp = Date.now();
  await context.addInitScript(() => {
    localStorage.setItem('mg_season_mode', 'off');
    localStorage.setItem('mg_ambient_canvas', 'false');
  });
  async function signup(ctx, name) {
    const r = await ctx.request.post(base + '/api/auth', {
      data: {
        action: 'register',
        email: `talk-${name}-${stamp}@example.test`,
        username: name + stamp,
        password: 'isolated-cinema-talk-password',
      },
    });
    assert.equal(r.status(), 200);
    const user = (await r.json()).user;
    users.push(user.id);
    return user;
  }
  const me = await signup(context, 'Talk'),
    a = await signup(other, 'FriendA'),
    b = await signup(other, 'FriendB'),
    stranger = await signup(other, 'Stranger');
  a.username = 'ДлинноеИмяБезПробелов' + String(stamp).slice(-4);
  await db.query('update mg_users set username=$1 where id=$2', [
    a.username,
    a.id,
  ]);
  await db.query(
    "insert into mg_friendships(from_id,to_id,status)values($1,$2,'accepted'),($3,$1,'accepted')",
    [me.id, a.id, b.id],
  );
  for (let i = 0; i < 3; i++)
    films.push(
      (
        await db.query(
          "insert into mg_movies(title,description,category,genre,year,duration,poster)values($1,'Conversation fixture','Фильм','Драма',2024,120,'/brand/moviemovie-logo.png')returning id",
          [['Большая история', 'Совпадение', 'Только моё'][i] + ' ' + stamp],
        )
      ).rows[0].id,
    );
  await db.query(
    'insert into mg_ratings(user_id,movie_id,value)values($1,$3,4),($2,$3,9),($1,$4,9),($2,$4,9.5),($1,$5,7)',
    [me.id, a.id, ...films],
  );
  await db.query(
    'insert into mg_messages(from_id,to_id,body)values($1,$2,$3),($4,$2,$5)',
    [
      a.id,
      me.id,
      'Что посмотреть сегодня? ' + stamp,
      b.id,
      'Другая переписка ' + stamp,
    ],
  );
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const load = async (path) => {
    await page.goto(base + path);
    await page.locator('.cinema-messages,.cinema-comparison').waitFor();
    await page.waitForFunction(
      () => document.documentElement.dataset.hudBusy !== 'true',
    );
  };
  const contact = (name) =>
    page.locator('.chat-contact').filter({ hasText: name });
  const message = () =>
    page.getByRole('textbox', { name: 'Сообщение', exact: true });
  await load('/chat');
  await contact(a.username).waitFor();
  await page
    .getByRole('textbox', { name: 'Найти диалог', exact: true })
    .fill('НЕСУЩЕСТВУЮЩИЙ');
  await page
    .getByRole('button', { name: 'Очистить поиск', exact: true })
    .click();
  await contact(a.username).click();
  await page
    .getByRole('log')
    .getByText('Что посмотреть сегодня? ' + stamp, { exact: true })
    .waitFor();
  assert.equal(
    (
      await db.query(
        'select count(*)::int n from mg_messages where from_id=$1 and to_id=$2 and read=false',
        [a.id, me.id],
      )
    ).rows[0].n,
    0,
  );
  await message().fill('Черновик для А');
  await contact(b.username).click();
  assert.equal(await message().inputValue(), '');
  await message().fill('Черновик для Б');
  await contact(a.username).click();
  assert.equal(await message().inputValue(), 'Черновик для А');
  // Initial thread loading errors are retryable, not false empty histories.
  await context.route('**/api/chat?with=' + b.id, (r) =>
    r.fulfill({ status: 503, json: { error: 'temporary' } }),
  );
  await contact(b.username).click();
  await page.locator('.cinema-conversation .cinema-chat-error').waitFor();
  assert.equal(
    await page.getByText('Первая реплика — за тобой.', { exact: true }).count(),
    0,
  );
  await context.unroute('**/api/chat?with=' + b.id);
  await page
    .locator('.cinema-conversation')
    .getByRole('button', { name: 'Повторить', exact: true })
    .click();
  await page
    .getByRole('log')
    .getByText('Другая переписка ' + stamp, { exact: true })
    .waitFor();
  await contact(a.username).click();
  await context.route('**/api/chat', (r) =>
    r.request().method() === 'POST'
      ? r.fulfill({ status: 503, json: { error: 'Тестовая ошибка отправки' } })
      : r.continue(),
  );
  await page
    .getByRole('button', { name: 'Отправить сообщение', exact: true })
    .click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Тестовая ошибка отправки' })
    .waitFor();
  assert.equal(await message().inputValue(), 'Черновик для А');
  await context.unroute('**/api/chat');
  // One explicit send despite repeated Enter/click; edits made during flight survive success.
  let release, started;
  const held = new Promise((r) => (release = r)),
    requestStarted = new Promise((r) => (started = r));
  let posts = 0;
  await context.route('**/api/chat', async (r) => {
    if (r.request().method() !== 'POST') return r.continue();
    posts++;
    started();
    await held;
    await r.continue();
  });
  await page
    .getByRole('button', { name: 'Отправить сообщение', exact: true })
    .click();
  await requestStarted;
  await message().press('Enter');
  await message().fill('Новый черновик');
  release();
  await page
    .getByRole('log')
    .getByText('Черновик для А', { exact: true })
    .waitFor();
  assert.equal(posts, 1);
  assert.equal(await message().inputValue(), 'Новый черновик');
  await context.unroute('**/api/chat');
  assert.equal(
    (
      await db.query(
        'select count(*)::int n from mg_messages where from_id=$1 and to_id=$2 and body=$3',
        [me.id, a.id, 'Черновик для А'],
      )
    ).rows[0].n,
    1,
  );
  // Explicit film-only sending and native catalog entry.
  await message().fill('');
  await page
    .getByRole('button', { name: 'Поделиться фильмом', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Найти фильм для отправки', exact: true })
    .fill('Большая история ' + stamp);
  await page.locator('.chat-share-item').first().click();
  await page
    .locator('.shared-film-card')
    .filter({ hasText: 'Большая история ' + stamp })
    .waitFor();
  assert.equal(
    (
      await db.query(
        'select count(*)::int n from mg_messages where from_id=$1 and to_id=$2 and movie_id=$3',
        [me.id, a.id, films[0]],
      )
    ).rows[0].n,
    1,
  );
  await page
    .locator('.shared-film-card')
    .filter({ hasText: 'Большая история ' + stamp })
    .click();
  await page.waitForURL('**/movie/' + films[0]);
  // Server remains authoritative: non-friends cannot fetch or send a thread.
  assert.equal(
    (
      await context.request.get(base + '/api/chat?with=' + stranger.id)
    ).status(),
    403,
  );
  assert.equal(
    (
      await context.request.post(base + '/api/chat', {
        data: { toId: stranger.id, text: 'forbidden' },
      })
    ).status(),
    400,
  );
  // Comparison uses explicit common ratings; neither missing ratings nor watches count.
  await load('/compare/' + a.id);
  await page.locator('.cinema-comparison-grid .compare-row').first().waitFor();
  assert.equal(await page.locator('.compare-row').count(), 2);
  await page
    .getByRole('group', { name: 'Взгляды на кино' })
    .getByRole('button', { name: 'Главные споры', exact: true })
    .click();
  assert.equal(await page.locator('.compare-row').count(), 1);
  assert.match(
    await page.locator('.compare-info').innerText(),
    /Большая история/,
  );
  await page.getByRole('button', { name: 'Единодушие', exact: true }).click();
  assert.equal(await page.locator('.compare-row').count(), 1);
  assert.match(await page.locator('.compare-info').innerText(), /Совпадение/);
  await page
    .getByRole('textbox', { name: 'Найти общую историю', exact: true })
    .fill('нет такого');
  await page
    .getByRole('button', { name: 'Показать все общие', exact: true })
    .click();
  assert.equal(await page.locator('.compare-row').count(), 2);
  await load('/compare/' + b.id);
  await page
    .getByRole('heading', { name: 'Нет общих оценок', exact: true })
    .waitFor();
  await context.route('**/api/profile?id=' + a.id, (r) =>
    r.fulfill({ status: 503, json: { error: 'temporary' } }),
  );
  await load('/compare/' + a.id);
  await page
    .getByRole('heading', { name: 'Сравнение пока недоступно', exact: true })
    .waitFor();
  await context.unroute('**/api/profile?id=' + a.id);
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await page.locator('.compare-row').first().waitFor();
  // Existing quick-view preserves this comparison's filters, route and focus.
  await page.getByRole('button', { name: 'Единодушие', exact: true }).click();
  const trigger = page.locator('.cinema-compare-open').first();
  await trigger.click();
  await page.locator('.movie-quick-view').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(
    await trigger.evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(new URL(page.url()).pathname, '/compare/' + a.id);
  assert.equal(await page.locator('.compare-row').count(), 1);
  // Modal mini-chat has keyboard containment, Escape and trigger focus restoration.
  const openDrawer = async () => {
    await page.goto(base + '/friends');
    await page
      .locator('.person-card')
      .filter({ hasText: a.username })
      .getByRole('button', { name: 'Чат', exact: true })
      .click();
    await page.locator('dialog.chat-drawer[open]').waitFor();
  };
  await openDrawer();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    assert(
      await page
        .locator('dialog.chat-drawer')
        .evaluate((el) => el.contains(document.activeElement)),
    );
  }
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.chat-drawer').count(), 0);
  assert.equal(
    await page
      .locator('.person-card')
      .filter({ hasText: a.username })
      .getByRole('button', { name: 'Чат', exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await openDrawer();
  await page
    .getByRole('button', { name: 'Открыть полный чат', exact: true })
    .click();
  await page.waitForURL('**/chat?with=' + a.id);
  await page
    .getByRole('log')
    .getByText('Черновик для А', { exact: true })
    .waitFor();
  const geometry = async (label) => {
    const problems = await page
      .locator('.cinema-messages,.cinema-comparison,dialog.chat-drawer')
      .evaluateAll((roots) => {
        const out = [];
        if (document.documentElement.scrollWidth > innerWidth + 1)
          out.push('page overflow');
        for (const root of roots)
          for (const el of root.querySelectorAll(
            '.chat-layout,.chat-header,.chat-compose,.chat-bubble,.shared-film-card,.chat-contact,.cinema-comparison-spotlight,.compare-row,.cinema-comparison-people,.compare-scores',
          )) {
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            if (r.left < 0 || r.right > innerWidth + 1)
              out.push(el.className + ' outside');
            if (el.scrollWidth > el.clientWidth + 2)
              out.push(el.className + ' overflow');
          }
        return out;
      });
    assert.deepEqual(problems, [], label);
  };
  for (const theme of ['dark', 'light', 'pink', 'purple', 'yellow']) {
    await page.evaluate((t) => localStorage.setItem('mg_theme', t), theme);
    for (const [label, path] of [
      ['inbox', '/chat'],
      ['thread', '/chat?with=' + a.id],
      ['compare', '/compare/' + a.id],
    ]) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await load(path);
      if (label === 'thread')
        await page
          .getByRole('log')
          .getByText('Черновик для А', { exact: true })
          .waitFor();
      if (label === 'compare')
        await page.locator('.compare-row').first().waitFor();
      for (const width of [320, 390, 600, 760, 900, 1182, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => {
          document.activeElement?.blur();
          scrollTo(0, 0);
        });
        await page.waitForTimeout(100);
        await geometry(`${label}/${theme}/${width}`);
        assert.equal(
          await page
            .locator('.cinema-messages h1,.cinema-comparison h1')
            .count(),
          1,
        );
        if (['dark', 'light'].includes(theme) && [390, 1440].includes(width))
          await page.screenshot({
            path: `${shots}/${label}-${theme}-${width}.png`,
          });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 1000 });
  await load('/chat?with=' + a.id);
  await page
    .getByRole('button', { name: 'Назад к диалогам', exact: true })
    .click();
  await contact(b.username).waitFor();
  assert.equal(
    await page
      .getByRole('textbox', { name: 'Найти диалог', exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.setViewportSize({ width: 390, height: 800 });
  await load('/chat?with=' + a.id);
  await page
    .getByRole('log')
    .getByText('Черновик для А', { exact: true })
    .waitFor();
  assert(
    await page
      .locator('.chat-compose')
      .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight - 64),
    'Composer clears the mobile bottom navigation',
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openDrawer();
  for (const width of [320, 390, 600, 760, 900, 1182, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await geometry('drawer/' + width);
    const fits = await page.locator('.chat-drawer').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight + 1;
    });
    assert(fits);
  }
  await message().fill('Привет из мини-чата');
  await page
    .getByRole('button', { name: 'Отправить сообщение', exact: true })
    .click();
  await page
    .getByRole('log')
    .getByText('Привет из мини-чата', { exact: true })
    .waitFor();
  await page.keyboard.press('Escape');
  const guest = await browser.newContext(),
    g = await guest.newPage();
  let privateReads = 0;
  g.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/chat') privateReads++;
  });
  for (const path of ['/chat', '/compare/' + a.id]) {
    await g.goto(base + path);
    await g
      .getByRole('button', {
        name: 'Войти или зарегистрироваться',
        exact: true,
      })
      .waitFor();
    assert.equal(
      await g.locator('.cinema-conversation,.compare-row').count(),
      0,
    );
  }
  assert.equal(privateReads, 0);
  await guest.close();
  assert.equal(
    (
      await db.query(
        'select count(*)::int n from mg_watches where user_id=$1',
        [me.id],
      )
    ).rows[0].n,
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS conversations: real friend-only messages/film sends/read state, per-peer drafts, duplicate guard and in-flight edits, retryable load/send errors, conversation isolation, compare intersections/scopes/search/quick view/empty/retry, modal mini-chat focus/Escape/expand, mobile contact return, guest gates, five themes × eight widths × three screens and eight drawer widths; no automatic watches.',
  );
  await context.close();
  await other.close();
} finally {
  await browser.close();
  if (users.length) {
    await db.query(
      'delete from mg_messages where from_id=any($1::int[]) or to_id=any($1::int[])',
      [users],
    );
    await db.query(
      'delete from mg_notifications where user_id=any($1::int[]) or actor_id=any($1::int[])',
      [users],
    );
    await db.query(
      'delete from mg_friendships where from_id=any($1::int[]) or to_id=any($1::int[])',
      [users],
    );
    await db.query('delete from mg_ratings where user_id=any($1::int[])', [
      users,
    ]);
    await db.query('delete from mg_users where id=any($1::int[])', [users]);
  }
  if (films.length)
    await db.query('delete from mg_movies where id=any($1::int[])', [films]);
  await db.end();
}
