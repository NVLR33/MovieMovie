// Actual production UI/API; isolated local fixture only. Provider requests are intercepted, never sent.
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
    (x) => !['--single-process', '--disable-web-security'].includes(x),
  ),
  headless: true,
});
const ids = [];
let userId;
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const remote = [],
    errors = [];
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin) return route.continue();
    remote.push(url.href);
    if (url.pathname.endsWith('.mp4'))
      return route.fulfill({ status: 404, body: '' });
    return route.fulfill({
      contentType: 'text/html',
      body: '<p>Isolated provider fixture</p>',
    });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const stamp = Date.now();
  const signup = await context.request.post(base + '/api/auth', {
    data: {
      action: 'register',
      email: `playback-${stamp}@example.test`,
      username: `Playback${stamp}`,
      password: 'isolated-playback-password',
    },
  });
  assert.equal(signup.status(), 200);
  userId = (await signup.json()).user.id;
  await db.query("update mg_users set role='admin' where id=$1", [userId]);
  const form = {
    action: 'movieSave',
    title: `Просмотр ${stamp}`,
    description: 'Разрешённое тестовое видео',
    category: 'Фильм',
    genre: 'Драма',
    year: 2024,
    duration: 90,
    poster: '/brand/moviemovie-logo.png',
    watchUrl: 'https://example.org/watch',
    trailerUrl: '',
    playbackUrl: 'https://vkvideo.ru/video-12_34',
  };
  async function action(body, status = 200) {
    const response = await context.request.post(base + '/api/action', {
      data: body,
    });
    const data = await response.json();
    assert.equal(response.status(), status, JSON.stringify(data));
    return data;
  }
  const saved = await action(form);
  ids.push(saved.movieId);
  assert.equal(
    (await db.query('select playback_url from mg_movies where id=$1', ids))
      .rows[0].playback_url,
    'https://vk.com/video_ext.php?oid=-12&id=34',
  );
  await action(
    { ...form, id: ids[0], playbackUrl: 'https://evil.org/embed' },
    400,
  );
  // Old clients omitting the field do not erase a curated source.
  const { playbackUrl: omitted, ...legacy } = form;
  await action({ ...legacy, id: ids[0] });
  assert.equal(
    (await db.query('select playback_url from mg_movies where id=$1', ids))
      .rows[0].playback_url,
    omitted.replace(
      'https://vkvideo.ru/video-12_34',
      'https://vk.com/video_ext.php?oid=-12&id=34',
    ),
  );
  await page.goto(base + '/movie/' + ids[0]);
  const watch = page.locator('.material-watch-button').first();
  await watch.waitFor();
  assert.equal(
    await page
      .locator('.material-player iframe,.material-player video')
      .count(),
    0,
  );
  assert.equal(remote.length, 0);
  await page
    .getByRole('button', { name: 'Редактировать материал', exact: true })
    .click();
  assert.equal(
    await page
      .getByLabel('Источник просмотра на сайте', { exact: true })
      .inputValue(),
    'https://vk.com/video_ext.php?oid=-12&id=34',
  );
  await page
    .getByRole('button', { name: 'Закрыть форму материала', exact: true })
    .click();
  await watch.click();
  const dialog = page.getByRole('dialog', {
    name: `Просмотр: ${form.title}`,
    exact: true,
  });
  await dialog.waitFor();
  assert.equal(await dialog.locator('iframe,video').count(), 0);
  assert.equal(
    remote.length,
    0,
    'Consent screen must not contact a provider',
  );
  await dialog
    .getByRole('button', { name: 'Подключить VK Видео', exact: true })
    .click();
  await dialog.locator('iframe').waitFor();
  await page.waitForFunction(() =>
    document
      .querySelector('.material-player iframe')
      ?.getAttribute('src')
      ?.includes('video_ext.php'),
  );
  assert.equal(
    await dialog.locator('iframe').getAttribute('src'),
    'https://vk.com/video_ext.php?oid=-12&id=34',
  );
  assert.equal(
    await dialog.locator('iframe').getAttribute('referrerpolicy'),
    'no-referrer',
  );
  assert(
    !(await dialog.locator('iframe').getAttribute('sandbox')).includes(
      'allow-top-navigation',
    ),
  );
  await dialog
    .getByRole('button', { name: 'Отключить источник', exact: true })
    .click();
  assert.equal(await dialog.locator('iframe,video').count(), 0);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assert(
    await watch.evaluate((el) => el === document.activeElement),
    'Focus returns to watch trigger',
  );
  const viewsBefore = (
    await db.query(
      'select count(*)::int n from mg_watches where user_id=$1',
      [userId],
    )
  ).rows[0].n;
  assert.equal(viewsBefore, 0, 'Playback does not mark watched');
  // MP4 errors, retry, manual external fallback, mobile and a fresh consent screen on every open.
  await action({
    ...form,
    id: ids[0],
    playbackUrl: 'https://media.moviemovie-demo.org/movie.mp4',
  });
  await page.reload();
  await watch.click();
  await dialog
    .getByRole('button', { name: 'Подключить MP4', exact: true })
    .click();
  const video = dialog.locator('video');
  await video.waitFor();
  assert.equal(await video.getAttribute('autoplay'), null);
  assert.equal(await video.getAttribute('preload'), 'none');
  await video.dispatchEvent('error');
  await dialog.getByRole('alert').waitFor();
  assert.equal(
    await dialog
      .getByRole('link', { name: 'Открыть у источника' })
      .getAttribute('href'),
    'https://media.moviemovie-demo.org/movie.mp4',
  );
  await dialog
    .getByRole('button', { name: 'Попробовать снова', exact: true })
    .click();
  await video.waitFor();
  fs.mkdirSync('/tmp/mm-playback-screenshots', { recursive: true });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
  }
  await dialog.screenshot({
    path: '/tmp/mm-playback-screenshots/player.png',
  });
  await page.keyboard.press('Escape');
  await watch.click();
  assert.equal(await dialog.locator('video,iframe').count(), 0);
  await page.keyboard.press('Escape');
  // Full episode source roundtrip, moderator-only write and public read.
  const serial = await action({
    ...form,
    title: `Сериал ${stamp}`,
    category: 'Сериал',
    playbackUrl: '',
  });
  ids.push(serial.movieId);
  const seriesPost = async (body, status = 200) => {
    const r = await context.request.post(base + '/api/series', {
      data: { movieId: serial.movieId, ...body },
    });
    assert.equal(r.status(), status, await r.text());
  };
  await seriesPost({
    action: 'saveSeason',
    number: 1,
    title: 'Первый',
    episodeCount: 1,
  });
  let snapshot = await (
    await context.request.get(base + '/api/series?movieId=' + serial.movieId)
  ).json();
  const episodeId = snapshot.seasons[0].episodes[0].id;
  await db.query(
    'update mg_movies set series_catalog_complete=true where id=$1',
    [serial.movieId],
  );
  const rutube = 'https://rutube.ru/video/0123456789abcdef0123456789abcdef/';
  await seriesPost({
    action: 'saveEpisode',
    id: episodeId,
    title: 'Пилот',
    playbackUrl: rutube,
  });
  await seriesPost(
    {
      action: 'saveEpisode',
      id: episodeId,
      title: 'Пилот',
      playbackUrl: 'javascript:alert(1)',
    },
    400,
  );
  assert.equal(
    (
      await db.query(
        'select series_catalog_complete from mg_movies where id=$1',
        [serial.movieId],
      )
    ).rows[0].series_catalog_complete,
    true,
    'Source/title edits do not invalidate catalog completeness',
  );
  await page.goto(base + '/movie/' + serial.movieId);
  await page.locator('.series-rating-row').first().waitFor();
  await page
    .getByRole('button', { name: 'Редактировать сезоны', exact: true })
    .click();
  assert.equal(
    await page
      .getByLabel('Источник: сезон 1, эпизод 1', { exact: true })
      .inputValue(),
    rutube.replace('/video/', '/play/embed/'),
  );
  await page
    .getByRole('button', { name: 'Закрыть редактор', exact: true })
    .click();
  await page.locator('.series-episodes .material-watch-button').click();
  const ep = page.getByRole('dialog', {
    name: 'Просмотр: Сезон 1 · Эпизод 1 · Пилот',
    exact: true,
  });
  await ep
    .getByRole('button', { name: 'Подключить Rutube', exact: true })
    .click();
  assert.equal(
    await ep.locator('iframe').getAttribute('src'),
    rutube.replace('/video/', '/play/embed/'),
  );
  await page.keyboard.press('Escape');
  // Read compatibility before schema rollout; writes must fail clearly, never lose a source.
  await db.query(
    'alter table mg_movies rename column playback_url to playback_url_compat_hidden',
  );
  try {
    const read = await context.request.get(base + '/api/data');
    assert.equal(read.status(), 200);
    assert.equal(
      (await read.json()).films.find((f) => f.id === ids[0]).playbackUrl,
      '',
    );
    await action({ ...form, id: ids[0] }, 503);
  } finally {
    await db.query(
      'alter table mg_movies rename column playback_url_compat_hidden to playback_url',
    );
  }
  await db.query(
    'alter table mg_series_episodes rename column playback_url to playback_url_compat_hidden',
  );
  try {
    const read = await context.request.get(
      base + '/api/series?movieId=' + serial.movieId,
    );
    assert.equal(read.status(), 200);
    assert.equal((await read.json()).seasons[0].episodes[0].playbackUrl, '');
    await seriesPost(
      {
        action: 'saveEpisode',
        id: episodeId,
        title: 'Пилот',
        playbackUrl: rutube,
      },
      503,
    );
  } finally {
    await db.query(
      'alter table mg_series_episodes rename column playback_url_compat_hidden to playback_url',
    );
  }
  await db.query("update mg_users set role='visitor' where id=$1", [userId]);
  await seriesPost(
    { action: 'saveEpisode', id: episodeId, title: 'Пилот', playbackUrl: '' },
    403,
  );
  const guest = await browser.newContext();
  snapshot = await (
    await guest.request.get(base + '/api/series?movieId=' + serial.movieId)
  ).json();
  assert.equal(
    snapshot.seasons[0].episodes[0].playbackUrl,
    rutube.replace('/video/', '/play/embed/'),
  );
  assert.equal(
    (
      await guest.request.post(base + '/api/series', {
        data: {
          action: 'saveEpisode',
          movieId: serial.movieId,
          id: episodeId,
          title: 'Нет',
          playbackUrl: '',
        },
      })
    ).status(),
    401,
  );
  assert.deepEqual(errors, []);
  await guest.close();
  await context.close();
  console.log(
    'Passed external playback: canonical movie/episode persistence, validation/permissions, no provider requests before consent, iframe isolation/teardown/focus, no autoplay, MP4 error/retry/fallback, 4 widths, no automatic watch tracking, rolling-schema read compatibility and explicit write failures. Provider fixtures intercepted; real provider availability not tested.',
  );
} finally {
  if (ids.length)
    await db.query(
      "delete from mg_admin_audit where target_type='movie' and target_id=any($1::int[])",
      [ids],
    );
  for (const id of ids) {
    await db.query('delete from mg_series_seasons where movie_id=$1', [id]);
    await db.query('delete from mg_movies where id=$1', [id]);
  }
  if (userId) {
    await db.query('delete from mg_admin_audit where actor_id=$1', [userId]);
    await db.query(
      'delete from mg_notifications where user_id=$1 or actor_id=$1',
      [userId],
    );
    await db.query('delete from mg_cinema_pets where user_id=$1', [userId]);
    await db.query('delete from mg_users where id=$1', [userId]);
  }
  await browser.close();
  await db.end();
}
