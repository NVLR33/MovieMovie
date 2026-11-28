// Production browser and real notification/auth actions in the marker-guarded local DB.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { Client } from "pg";
const deps = createRequire(
  process.env.UI_TEST_DEPS
    ? resolve(process.env.UI_TEST_DEPS, "package.json")
    : import.meta.url,
);
const { chromium: pw } = deps("playwright-core"),
  chromium = deps("@sparticuz/chromium").default;
const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:3000";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
assert.equal(
  new URL(process.env.AUDIT_DATABASE_URL).searchParams.get("host"),
  "/tmp/mm-audit-pg",
);
const db = new Client({ connectionString: process.env.AUDIT_DATABASE_URL });
await db.connect();
assert.equal(
  (await db.query("select value from mm_audit_fixture where key='isolated'"))
    .rows[0]?.value,
  "yes",
);
const browser = await pw.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter(
    (a) => !["--single-process", "--disable-web-security"].includes(a),
  ),
  headless: true,
});
const noticeIds = [];
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const signup = await context.request.post(base + "/api/auth", {
    data: {
      action: "register",
      email: `header-${Date.now()}@example.test`,
      username: `Header${Date.now()}`,
      password: "isolated-header-password",
    },
  });
  assert.equal(signup.status(), 200);
  const user = (await signup.json()).user;
  const other = (
    await db.query("select id from mg_users where id<>$1 order by id limit 1", [
      user.id,
    ])
  ).rows[0];
  assert(other);
  const movie = (await db.query("select id from mg_movies order by id limit 1"))
    .rows[0];
  assert(movie);
  for (let i = 0; i < 26; i++) {
    const id = (
      await db.query(
        "insert into mg_notifications(user_id,message,link,read,created_at)values($1,$2,$3,$4,$5)returning id",
        [
          user.id,
          i === 0
            ? "Киноман ответил(а) на ваш комментарий"
            : i === 1
              ? "Киноман приглашает вас в друзья"
              : i === 2
                ? "Киноман рекомендует фильм"
                : `Архивное уведомление ${i}`,
          i === 25
            ? "//evil.test"
            : i === 1
              ? "/friends"
              : `/movie/${movie.id}`,
          i >= 3,
          new Date(Date.now() - (i * 86400000) / 3),
        ],
      )
    ).rows[0].id;
    noticeIds.push(id);
  }
  const foreign = (
    await db.query(
      "insert into mg_notifications(user_id,message,read)values($1,'Чужое приватное уведомление',false)returning id",
      [other.id],
    )
  ).rows[0].id;
  noticeIds.push(foreign);
  const panel = page.getByRole("dialog", { name: "Уведомления", exact: true }),
    menu = page.getByRole("dialog", { name: "Твой аккаунт", exact: true });
  const openNotices = async () => {
    await page.locator(".notice-button").click();
    await panel.waitFor();
  };
  const openMenu = async () => {
    await page.locator(".user-trigger").click();
    await menu.waitFor();
  };
  const close = async (dialog) => {
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
  };
  const waitCount = async (n) =>
    page.waitForFunction(
      (n) =>
        Number(document.querySelector(".notice-count")?.textContent || 0) === n,
      n,
    );
  await page.goto(base);
  await waitCount(3);
  await openNotices();
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from mg_notifications where user_id=$1 and not read",
        [user.id],
      )
    ).rows[0].n,
    3,
    "Opening does not mark all read",
  );
  assert.equal(
    await panel.locator(".notice-entry").count(),
    20,
    "Not silently limited to eight",
  );
  await panel.getByRole("button", { name: /Показать ещё/ }).click();
  assert.equal(await panel.locator(".notice-entry").count(), 26);
  assert.equal(
    await panel
      .getByText("Чужое приватное уведомление", { exact: true })
      .count(),
    0,
  );
  const unsafe = panel.getByRole("button", {
    name: "Архивное уведомление 25",
    exact: true,
  });
  assert.equal(await unsafe.isDisabled(), true);
  await panel
    .getByRole("group", { name: "Фильтр уведомлений" })
    .getByRole("button", { name: /Непрочитанные/ })
    .click();
  assert.equal(await panel.locator(".notice-entry").count(), 3);
  const message = "Киноман ответил(а) на ваш комментарий";
  await panel
    .getByRole("button", {
      name: `Отметить прочитанным: ${message}`,
      exact: true,
    })
    .click();
  await waitCount(2);
  assert.equal(await panel.locator(".notice-entry").count(), 2);
  await panel
    .getByRole("group", { name: "Фильтр уведомлений" })
    .getByRole("button", { name: /^Все/ })
    .click();
  await panel
    .getByRole("button", {
      name: `Отметить непрочитанным: ${message}`,
      exact: true,
    })
    .click();
  await waitCount(3);
  const search = panel.getByRole("searchbox", {
    name: "Поиск по уведомлениям",
  });
  await search.fill("Не существующая строка");
  await panel
    .getByRole("heading", { name: "Ничего не найдено", exact: true })
    .waitFor();
  await search.fill("");
  for (const theme of ["dark", "light"]) {
    await page.evaluate(
      (theme) => (document.documentElement.dataset.theme = theme),
      theme,
    );
    for (const width of [320, 360, 390, 600, 760, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction(() => {
        const el = document.querySelector(".header-account-dialog");
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return (
          r.width >= Math.min(290, innerWidth - 24) &&
          r.top >= 0 &&
          r.bottom <= innerHeight + 1 &&
          r.left >= 0 &&
          r.right <= innerWidth + 1 &&
          el.scrollWidth <= el.clientWidth + 1
        );
      });
      assert(
        await panel.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.left >= 0 &&
            r.right <= innerWidth + 1 &&
            r.top >= 0 &&
            r.bottom <= innerHeight + 1 &&
            el.scrollWidth <= el.clientWidth + 1
          );
        }),
        `notice geometry ${theme} ${width}`,
      );
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press("Tab");
        assert(
          await panel.evaluate((el) => el.contains(document.activeElement)),
        );
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 420 });
  await search.focus();
  await page.waitForFunction(() => {
    const el = document.querySelector(".header-account-dialog");
    const r = el.getBoundingClientRect();
    return (
      r.top >= 0 &&
      r.bottom <= innerHeight + 1 &&
      el.scrollWidth <= el.clientWidth + 1
    );
  });
  await close(panel);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openNotices();
  await page.mouse.click(5, 5);
  await panel.waitFor({ state: "detached" });
  assert.equal(
    await page
      .locator(".notice-button")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  assert.notEqual(
    await page.evaluate(() => document.body.style.overflow),
    "hidden",
  );
  await openNotices();
  // Mutations fail visibly; the unread state remains retryable.
  const fail = async (route) =>
    route.fulfill({ status: 502, json: { error: "Тестовая ошибка сети" } });
  await page.route("**/api/action", fail);
  await panel
    .getByRole("button", {
      name: `Отметить прочитанным: ${message}`,
      exact: true,
    })
    .click();
  await panel.getByRole("alert").waitFor();
  await waitCount(3);
  await page.unroute("**/api/action", fail);
  await panel.getByRole("button", { name: message, exact: true }).click();
  await page.waitForURL(base + `/movie/${movie.id}`);
  await waitCount(2);
  assert.equal(await page.locator(".header-account-dialog").count(), 0);
  await openNotices();
  await panel
    .getByRole("button", { name: "Прочитать всё", exact: true })
    .click();
  await waitCount(0);
  assert.equal(
    (await db.query("select read from mg_notifications where id=$1", [foreign]))
      .rows[0].read,
    false,
  );
  await panel
    .getByRole("group", { name: "Фильтр уведомлений" })
    .getByRole("button", { name: /Непрочитанные/ })
    .click();
  await panel
    .getByRole("heading", { name: "Всё прочитано", exact: true })
    .waitFor();
  await close(panel);
  assert.equal(
    await page
      .locator(".notice-button")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await openMenu();
  assert.equal(
    await menu
      .getByRole("link", { name: "Центр управления", exact: true })
      .count(),
    0,
  );
  await menu
    .getByRole("button", { name: "Настройки сайта", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Настройки сайта", exact: true })
    .waitFor();
  assert.equal(await page.locator(".header-account-dialog").count(), 0);
  await page.keyboard.press("Escape");
  await openMenu();
  await menu.getByRole("link", { name: /Буду смотреть/ }).click();
  await page.waitForURL(base + "/watchlist");
  await db.query("update mg_users set role='admin' where id=$1", [user.id]);
  await page.reload();
  await page
    .locator(".user-trigger-name")
    .getByText(user.username, { exact: true })
    .waitFor();
  await openMenu();
  await menu
    .getByRole("link", { name: "Центр управления", exact: true })
    .waitFor();
  await mkdir("/tmp/mm-account-screenshots", { recursive: true });
  for (const theme of ["dark", "light"]) {
    await page.evaluate(
      (theme) => (document.documentElement.dataset.theme = theme),
      theme,
    );
    for (const width of [320, 390, 760, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction(() => {
        const el = document.querySelector(".header-account-dialog");
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return (
          r.top >= 0 &&
          r.bottom <= innerHeight + 1 &&
          r.width >= Math.min(290, innerWidth - 24) &&
          r.left >= 0 &&
          r.right <= innerWidth + 1 &&
          el.scrollWidth <= el.clientWidth + 1
        );
      });
      assert(
        await menu.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.left >= 0 &&
            r.right <= innerWidth + 1 &&
            r.top >= 0 &&
            r.bottom <= innerHeight + 1 &&
            el.scrollWidth <= el.clientWidth + 1
          );
        }),
        `account geometry ${theme} ${width}`,
      );
      if (width !== 320)
        await menu.screenshot({
          path: `/tmp/mm-account-screenshots/account-${theme}-${width}.png`,
        });
    }
  }
  await close(menu);
  await openNotices();
  await panel
    .getByRole("group", { name: "Фильтр уведомлений" })
    .getByRole("button", { name: /^Все/ })
    .click();
  await panel.screenshot({
    path: "/tmp/mm-account-screenshots/notifications-desktop.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.screenshot({
    path: "/tmp/mm-account-screenshots/notifications-mobile.png",
  });
  await close(panel);
  await openMenu();
  await page.route("**/api/auth", fail);
  await menu
    .getByRole("button", { name: "Выйти из аккаунта", exact: true })
    .click();
  await menu.getByRole("alert").waitFor();
  assert(await menu.isVisible());
  await page.unroute("**/api/auth", fail);
  await menu
    .getByRole("button", { name: "Выйти из аккаунта", exact: true })
    .click();
  await page.waitForURL(base + "/");
  await page
    .getByRole("button", { name: "Войти", exact: true })
    .first()
    .waitFor();
  assert.equal(await page.locator(".notice-count").count(), 0);
  await openNotices();
  await panel.getByRole("button", { name: "Войти", exact: true }).click();
  await page.locator(".auth-modal").waitFor();
  assert.equal(await page.locator(".header-account-dialog").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: actual ownership-scoped notification actions, no automatic read, individual/read-all/unread, search/filter/load-more, safe navigation and failures, top-layer geometry/focus across 8 widths/two themes, profile counts/roles/settings/links, failed/successful logout and guest auth. Isolated DB only.",
  );
} finally {
  if (noticeIds.length)
    await db.query("delete from mg_notifications where id=any($1::int[])", [
      noticeIds,
    ]);
  await browser.close();
  await db.end();
}
