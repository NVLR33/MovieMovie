// Real browser + real cookie sessions, guarded disposable local SQL fixture only.
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
  args: chromium.args.filter((a) => a !== '--single-process'),
  headless: true,
});
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    }),
    targetContext = await browser.newContext();
  const suffix = Date.now(),
    password = 'admin-browser-password';
  const signup = async (ctx, kind) => {
    const email = `admin-${kind}-${suffix}@example.test`,
      username = `${kind}${suffix}`;
    const r = await ctx.request.post(base + '/api/auth', {
      data: { action: 'register', email, username, password },
    });
    assert.equal(r.status(), 200);
    return { ...(await r.json()).user, email, username };
  };
  const admin = await signup(context, 'Manager'),
    target = await signup(targetContext, 'Member');
  await db.query("update mg_users set role='admin' where id=$1", [admin.id]);
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const workspace = page.getByRole('region', { name: 'Центр управления' });
  await page.goto(base + '/admin');
  await workspace
    .getByRole('heading', { name: 'Кто что может', exact: true })
    .waitFor();
  const api = await context.request.get(base + '/api/admin');
  assert.equal(api.status(), 200);
  assert.equal((await api.json()).permissions.manageUsers, true);
  const publicData = await targetContext.request.get(base + '/api/data');
  const self = (await publicData.json()).user;
  assert(!('sessionVersion' in self));
  assert(!('suspensionReason' in self));
  const tabs = [
    'Обзор',
    'Материалы',
    'Предложения',
    'Комментарии',
    'Пользователи и роли',
    'Журнал действий',
  ];
  fs.mkdirSync('/tmp/mm-admin-screenshots', { recursive: true });
  for (const label of tabs) {
    await workspace.getByRole('button', { name: label, exact: true }).click();
    await page.waitForTimeout(450);
    await workspace
      .getByText('Загружаем…', { exact: true })
      .waitFor({ state: 'detached' });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${label} overflow ${width}`,
      );
    }
  }
  await page.goto(base + '/admin?tab=users');
  await workspace
    .getByRole('textbox', { name: 'Поиск в разделе' })
    .fill(target.username);
  const account = workspace
    .locator('.admin-account')
    .filter({ hasText: target.username });
  await account.waitFor();
  await account
    .getByRole('checkbox', { name: `Редактор ${target.username}`, exact: true })
    .click();
  let dialog = page.getByRole('dialog', {
    name: 'Выдать право редактора?',
    exact: true,
  });
  await dialog.waitFor();
  await dialog
    .getByRole('button', { name: 'Подтвердить', exact: true })
    .click();
  await dialog.waitFor({ state: 'detached' });
  assert.equal(
    (await db.query('select is_editor from mg_users where id=$1', [target.id]))
      .rows[0].is_editor,
    true,
  );
  assert.equal(
    (await targetContext.request.get(base + '/api/admin')).status(),
    200,
  );
  assert.equal(
    (
      await targetContext.request.get(base + '/api/admin?section=users')
    ).status(),
    403,
  );
  const editorPage = await targetContext.newPage();
  await editorPage.goto(base + '/admin');
  const editor = editorPage.getByRole('region', { name: 'Центр управления' });
  await editor
    .getByRole('heading', { name: 'Кто что может', exact: true })
    .waitFor();
  assert.equal(
    await editor
      .getByRole('button', { name: 'Пользователи и роли', exact: true })
      .count(),
    0,
  );
  assert.equal(
    await editor
      .getByRole('button', { name: 'Комментарии', exact: true })
      .count(),
    0,
  );
  await editor
    .getByRole('button', { name: 'Добавить материал', exact: true })
    .click();
  await editorPage.getByRole('dialog').waitFor();
  await editorPage.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.screenshot({
    path: '/tmp/mm-admin-screenshots/users-mobile.png',
    fullPage: true,
  });
  await account
    .getByRole('button', { name: 'Заблокировать', exact: true })
    .click();
  dialog = page.getByRole('dialog', {
    name: `Заблокировать ${target.username}?`,
    exact: true,
  });
  await dialog
    .getByLabel('Причина', { exact: true })
    .fill('Нарушение правил сообщества');
  await dialog
    .getByRole('button', { name: 'Подтвердить', exact: true })
    .click();
  await dialog.waitFor({ state: 'detached' });
  assert.equal(
    (await targetContext.request.get(base + '/api/auth')).status(),
    200,
  );
  assert.equal(
    (await (await targetContext.request.get(base + '/api/auth')).json()).user,
    null,
  );
  assert.equal(
    (
      await targetContext.request.post(base + '/api/auth', {
        data: { action: 'login', email: target.email, password },
      })
    ).status(),
    403,
  );
  assert.equal(
    (
      await targetContext.request.post(base + '/api/action', {
        data: { action: 'movieSave', title: 'Blocked' },
      })
    ).status(),
    401,
  );
  await account
    .getByRole('button', { name: 'Разблокировать', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Подтвердить', exact: true })
    .click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(
    (await (await targetContext.request.get(base + '/api/auth')).json()).user,
    null,
    'Unblock must not resurrect old cookies',
  );
  assert.equal(
    (
      await targetContext.request.post(base + '/api/auth', {
        data: { action: 'login', email: target.email, password },
      })
    ).status(),
    200,
  );
  await account
    .getByRole('button', { name: 'Завершить сессии', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Подтвердить', exact: true })
    .click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(
    (await (await targetContext.request.get(base + '/api/auth')).json()).user,
    null,
  );
  assert.equal(
    (
      await targetContext.request.post(base + '/api/auth', {
        data: { action: 'login', email: target.email, password },
      })
    ).status(),
    200,
  );
  // Role change invalidates the target's existing session, requiring a fresh sign-in.
  await account
    .getByRole('combobox', { name: `Роль ${target.username}` })
    .selectOption('moderator');
  dialog = page.getByRole('dialog');
  await dialog
    .getByRole('button', { name: 'Подтвердить', exact: true })
    .click();
  await dialog.waitFor({ state: 'detached' });
  assert.equal(
    (await (await targetContext.request.get(base + '/api/auth')).json()).user,
    null,
  );
  assert.equal(
    (
      await targetContext.request.post(base + '/api/auth', {
        data: { action: 'login', email: target.email, password },
      })
    ).status(),
    200,
  );
  await editorPage.goto(base + '/admin');
  await editor
    .getByRole('button', { name: 'Комментарии', exact: true })
    .waitFor();
  assert.equal(
    await editor
      .getByRole('button', { name: 'Пользователи и роли', exact: true })
      .count(),
    0,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await workspace
    .getByRole('button', { name: 'Журнал действий', exact: true })
    .click();
  await workspace
    .getByRole('textbox', { name: 'Поиск в разделе' })
    .fill(target.username);
  await workspace.locator('.admin-audit').first().waitFor();
  assert((await workspace.locator('.admin-audit').count()) >= 4);
  await page.screenshot({
    path: '/tmp/mm-admin-screenshots/audit-desktop.png',
    fullPage: true,
  });
  await workspace.getByRole('button', { name: 'Обзор', exact: true }).click();
  await workspace
    .getByRole('heading', { name: 'Кто что может', exact: true })
    .waitFor();
  await page.screenshot({
    path: '/tmp/mm-admin-screenshots/overview-desktop.png',
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    'Passed real browser admin six sections × four widths, independent editor UI and server privacy, confirmation dialogs, suspension/login denial, unblock without session resurrection, session revoke, role-change logout, moderator boundaries and private audit trail. Screenshots: /tmp/mm-admin-screenshots',
  );
} finally {
  await browser.close();
  await db.end();
}
