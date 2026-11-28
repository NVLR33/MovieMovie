// Actual production app, disposable marker-guarded local DB only. External players are intercepted.
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
  lists = [],
  shots = '/tmp/mm-together-screenshots';
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
  for (const pattern of [
    'https://www.youtube-nocookie.com/**',
    'https://rutube.ru/play/embed/**',
  ])
    await context.route(pattern, (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Isolated player fixture</title><p>Provider iframe intercepted for UI verification.</p>',
      }),
    );
  async function signup(ctx, name) {
    const response = await ctx.request.post(base + '/api/auth', {
      data: {
        action: 'register',
        email: `together-${name}-${stamp}@example.test`,
        username: name + stamp,
        password: 'isolated-cinema-together-password',
      },
    });
    assert.equal(response.status(), 200);
    const u = (await response.json()).user;
    users.push(u.id);
    return u;
  }
  const me = await signup(context, 'Ballot'),
    other = await signup(peer, 'Audience');
  await db.query(
    "insert into mg_friendships(from_id,to_id,status)values($1,$2,'accepted')",
    [me.id, other.id],
  );
  for (let i = 0; i < 3; i++)
    films.push(
      (
        await db.query(
          "insert into mg_movies(title,original_title,description,category,genre,year,duration,poster)values($1,$2,'Together fixture','Фильм','Драма',2024,120,'/brand/moviemovie-logo.png')returning id",
          ['Общий вечер ' + i + ' ' + stamp, 'OriginalTogether' + i + stamp],
        )
      ).rows[0].id,
    );
  const title = 'ВечерБезПробелов' + stamp;
  lists.push(
    (
      await db.query(
        'insert into mg_collab_lists(title,owner_id)values($1,$2)returning id',
        [title, me.id],
      )
    ).rows[0].id,
  );
  lists.push(
    (
      await db.query(
        'insert into mg_collab_lists(title,owner_id)values($1,$2)returning id',
        ['Чужая общая ' + stamp, other.id],
      )
    ).rows[0].id,
  );
  await db.query(
    'insert into mg_collab_items(list_id,movie_id,added_by_id,votes)values($1,$3,$5,0),($2,$4,$6,2)',
    [...lists, films[0], films[1], me.id, other.id],
  );
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const load = async (path, selector) => {
    await page.goto(base + path);
    await page.locator(selector).waitFor();
    await page.waitForFunction(
      () => document.documentElement.dataset.hudBusy !== 'true',
    );
  };
  const listButton = (name) =>
    page.locator('.ballot-index-items button').filter({ hasText: name });
  await load('/collab?view=personal', '.cinema-ballot');
  await listButton(title).click();
  const listSearch = page.getByRole('textbox', {
    name: 'Найти общую подборку',
    exact: true,
  });
  await listSearch.fill('НЕТ_ТАКОГО');
  await page
    .getByRole('button', { name: 'Показать все подборки', exact: true })
    .click();
  await listButton(title).click();
  await page
    .locator('.ballot-favorite')
    .getByRole('button', { name: 'Быстрый взгляд', exact: true })
    .click();
  await page.locator('.movie-quick-view').waitFor();
  await page.keyboard.press('Escape');
  assert.match(
    await page.locator('.ballot-list-heading h3').innerText(),
    new RegExp(title),
  );
  const input = page.getByRole('textbox', {
      name: 'Название совместной подборки',
      exact: true,
    }),
    newTitle = 'Новая общая ' + stamp;
  await input.fill(newTitle);
  await context.route('**/api/action', (r) =>
    r.request().postDataJSON()?.action === 'createList'
      ? r.fulfill({ status: 503, json: { error: 'temporary' } })
      : r.continue(),
  );
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  await page.locator('.ballot-create-panel [role=alert]').waitFor();
  assert.equal(await input.inputValue(), newTitle);
  await context.unroute('**/api/action');
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  await page.getByRole('heading', { name: newTitle, exact: true }).waitFor();
  lists.push(
    (
      await db.query(
        'select id from mg_collab_lists where owner_id=$1 and title=$2',
        [me.id, newTitle],
      )
    ).rows[0].id,
  );
  await page
    .getByRole('textbox', { name: 'Поиск материала: ' + newTitle, exact: true })
    .fill('OriginalTogether0' + stamp);
  await page
    .getByRole('combobox', {
      name: 'Материал для подборки: ' + newTitle,
      exact: true,
    })
    .selectOption(String(films[0]));
  await context.route('**/api/action', (r) =>
    r.request().postDataJSON()?.action === 'addToList'
      ? r.fulfill({ status: 503, json: { error: 'temporary' } })
      : r.continue(),
  );
  await page
    .getByRole('button', { name: 'Добавить в подборку', exact: true })
    .click();
  await page.locator('.showcase-collab-list [role=alert]').waitFor();
  assert.equal(
    await page
      .getByRole('combobox', {
        name: 'Материал для подборки: ' + newTitle,
        exact: true,
      })
      .inputValue(),
    String(films[0]),
  );
  await context.unroute('**/api/action');
  await page
    .getByRole('button', { name: 'Добавить в подборку', exact: true })
    .click();
  const vote = page.getByRole('button', {
    name: `Голос за Общий вечер 0 ${stamp}: 0`,
    exact: true,
  });
  await vote.waitFor();
  await vote.click();
  await page
    .getByRole('button', {
      name: `Голос за Общий вечер 0 ${stamp}: 1`,
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page
      .getByRole('combobox', {
        name: 'Материал для подборки: ' + newTitle,
        exact: true,
      })
      .locator('option[value="' + films[0] + '"]')
      .count(),
    0,
  );
  // Lists are deliberately public to signed-in members, not owner-only/private lists.
  await listButton('Чужая общая ' + stamp).click();
  await page
    .getByRole('button', {
      name: `Голос за Общий вечер 1 ${stamp}: 2`,
      exact: true,
    })
    .click();
  await page
    .getByRole('button', {
      name: `Голос за Общий вечер 1 ${stamp}: 3`,
      exact: true,
    })
    .waitFor();
  await load('/watchroom', '.cinema-room-lobby');
  assert.equal(
    await page
      .getByRole('button', { name: 'Сначала выбери фильм', exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page.locator('.room-share-friends button').first().isDisabled(),
    true,
  );
  await page
    .getByRole('textbox', { name: 'Поиск фильма для зала', exact: true })
    .fill('нет такой истории');
  await page
    .getByRole('button', { name: 'Очистить поиск', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Поиск фильма для зала', exact: true })
    .fill('OriginalTogether0' + stamp);
  await page.locator('.wrc-film-item').first().click();
  await page
    .locator('.room-share-friends button')
    .filter({ hasText: other.username })
    .click();
  await page.locator('.room-share-friends [role=status]').waitFor();
  assert(
    (
      await db.query(
        'select count(*)::int n from mg_notifications where user_id=$1 and actor_id=$2 and link=$3',
        [other.id, me.id, '/movie/' + films[0]],
      )
    ).rows[0].n >= 1,
  );
  await page
    .getByRole('textbox', { name: 'Код или ссылка на зал', exact: true })
    .fill('https://other.test/room/ABCD?movie=1');
  await page
    .getByRole('button', { name: 'Открыть по ссылке', exact: true })
    .click();
  await page.locator('.room-entry-panel [role=alert]').waitFor();
  assert.equal(new URL(page.url()).pathname, '/watchroom');
  await page
    .getByRole('textbox', { name: 'Код или ссылка на зал', exact: true })
    .fill(base + '/room/FRIENDS?movie=' + films[0]);
  await page
    .getByRole('button', { name: 'Открыть по ссылке', exact: true })
    .click();
  await page.waitForURL('**/room/FRIENDS?movie=' + films[0]);
  await page.locator('.cinema-local-room').waitFor();
  assert.equal(await page.locator('.room-iframe').count(), 0);
  let localWrites = 0;
  const record = (r) => {
    if (
      r.method() === 'POST' &&
      ['/api/chat', '/api/action'].includes(new URL(r.url()).pathname)
    )
      localWrites++;
  };
  page.on('request', record);
  await page
    .getByRole('textbox', { name: 'Локальная заметка', exact: true })
    .fill('Только моя вкладка');
  await page
    .getByRole('button', { name: 'Добавить локальную заметку', exact: true })
    .click();
  await page
    .getByRole('log', { name: 'Заметки в этой вкладке' })
    .getByText('Только моя вкладка', { exact: true })
    .waitFor();
  await page
    .getByRole('button', { name: 'Локальная реакция 🍿', exact: true })
    .click();
  assert.equal(localWrites, 0);
  const second = await context.newPage();
  await second.goto(page.url());
  await second.locator('.cinema-local-room').waitFor();
  assert.equal(
    await second.getByText('Только моя вкладка', { exact: true }).count(),
    0,
  );
  await second.close();
  const source = page.getByRole('textbox', {
    name: 'Ссылка на плеер',
    exact: true,
  });
  await source.fill('https://evil.example/player');
  await page.getByRole('button', { name: 'Запустить', exact: true }).click();
  await page.locator('.room-player-controls [role=alert]').waitFor();
  assert.equal(await page.locator('.room-iframe').count(), 0);
  await source.fill('https://youtu.be/dQw4w9WgXcQ');
  await page.getByRole('button', { name: 'Запустить', exact: true }).click();
  await page.locator('.room-iframe').waitFor();
  assert.equal(
    await page.locator('.room-iframe').getAttribute('src'),
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  );
  assert.equal(
    await page.locator('.room-iframe').getAttribute('sandbox'),
    'allow-scripts allow-same-origin allow-presentation',
  );
  await source.fill('https://rutube.ru/video/abc123/');
  await page
    .getByRole('button', { name: 'Сменить плеер', exact: true })
    .click();
  assert.equal(
    await page.locator('.room-iframe').getAttribute('src'),
    'https://rutube.ru/play/embed/abc123',
  );
  await page
    .getByRole('button', { name: 'Убрать плеер', exact: false })
    .click();
  assert.equal(await page.locator('.room-iframe').count(), 0);
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    }),
  );
  await page
    .getByRole('button', { name: 'Копировать ссылку', exact: true })
    .click();
  await page
    .getByRole('status')
    .filter({ hasText: 'Не удалось скопировать' })
    .waitFor();
  assert.equal(
    await page
      .getByRole('textbox', { name: 'Ссылка на локальный зал', exact: true })
      .inputValue(),
    '/room/FRIENDS?movie=' + films[0],
  );
  await page.reload();
  await page.locator('.cinema-local-room').waitFor();
  assert.equal(
    await page.getByText('Только моя вкладка', { exact: true }).count(),
    0,
  );
  assert.equal(await page.locator('.room-iframe').count(), 0);
  await load('/room/ABCD?movie=2147483647', '.cinema-local-room');
  await page
    .getByRole('heading', { name: 'Материал больше недоступен', exact: true })
    .waitFor();
  assert.equal(await page.locator('.room-iframe,.room-url-input').count(), 0);
  await load('/room/ABCD', '.cinema-local-room');
  await page
    .getByRole('heading', { name: 'Ссылка без выбранного фильма', exact: true })
    .waitFor();
  await load('/watchroom', '.cinema-room-lobby');
  await page
    .getByRole('textbox', { name: 'Поиск фильма для зала', exact: true })
    .fill('OriginalTogether1' + stamp);
  await page.locator('.wrc-film-item').first().click();
  await page
    .getByRole('button', { name: 'Открыть локальный зал', exact: true })
    .click();
  await page.waitForURL('**/room/*?movie=' + films[1]);
  const geometry = async (label) => {
    const issues = await page
      .locator('.cinema-ballot,.cinema-room-lobby,.cinema-local-room')
      .evaluateAll((roots) => {
        const bad = [];
        if (document.documentElement.scrollWidth > innerWidth + 1)
          bad.push('page overflow');
        for (const root of roots)
          for (const el of root.querySelectorAll(
            '.ballot-index,.showcase-collab-list,.ballot-favorite,.showcase-collab-add,.ballot-create-panel,.room-entry-panel,.room-session-plan,.wrc-film-item,.room-video-area,.room-player-controls,.room-notebook,.room-note-compose,.room-reference',
          )) {
            const r = el.getBoundingClientRect();
            if (r.width < 1 || r.left < 0 || r.right > innerWidth + 1)
              bad.push(el.className + ' outside');
            if (el.scrollWidth > el.clientWidth + 2)
              bad.push(el.className + ' overflow');
          }
        return bad;
      });
    assert.deepEqual(issues, [], label);
  };
  for (const theme of ['dark', 'light', 'pink', 'purple', 'yellow']) {
    await page.evaluate((t) => localStorage.setItem('mg_theme', t), theme);
    for (const [name, path, selector] of [
      ['ballot', '/collab?view=personal', '.cinema-ballot'],
      ['lobby', '/watchroom', '.cinema-room-lobby'],
      ['room', '/room/MATRIX?movie=' + films[0], '.cinema-local-room'],
    ]) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await load(path, selector);
      if (name === 'ballot') await listButton(title).click();
      for (const width of [320, 390, 600, 760, 900, 1182, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => {
          document.activeElement?.blur();
          scrollTo(0, 0);
        });
        await page.waitForTimeout(100);
        await geometry(`${name}/${theme}/${width}`);
        if (['dark', 'light'].includes(theme) && [390, 1440].includes(width))
          await page.screenshot({
            path: `${shots}/${name}-${theme}-${width}.png`,
          });
      }
    }
  }
  const guest = await browser.newContext(),
    g = await guest.newPage();
  for (const path of [
    '/collab?view=personal',
    '/watchroom',
    '/room/ABCD?movie=' + films[0],
  ]) {
    await g.goto(base + path);
    await g
      .getByRole('button', {
        name: 'Войти или зарегистрироваться',
        exact: true,
      })
      .waitFor();
    assert.equal(
      await g
        .locator('.cinema-ballot,.cinema-room-lobby,.cinema-local-room')
        .count(),
      0,
    );
  }
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
    'PASS together: real shared list creation/add/vote and failed drafts; public participation/active selection/search/quick view; selected-only film notifications; safe local reference parsing/no movie-one fallback; explicit allowlisted iframe start/replace/remove; local-only notes/reactions/reset/second-tab isolation; clipboard failure; guest gates; five themes × eight widths × three pages; no automatic watches. External player HTML intercepted, not live-provider playback verification.',
  );
  await context.close();
  await peer.close();
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
  if (lists.length) {
    await db.query('delete from mg_collab_items where list_id=any($1::int[])', [
      lists,
    ]);
    await db.query('delete from mg_collab_lists where id=any($1::int[])', [
      lists,
    ]);
  }
  if (films.length)
    await db.query('delete from mg_movies where id=any($1::int[])', [films]);
  if (users.length)
    await db.query('delete from mg_users where id=any($1::int[])', [users]);
  await db.end();
}
