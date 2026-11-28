// Real authenticated UI/API on a disposable, marker-guarded local database only.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readFile, mkdir } from "node:fs/promises";
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
const users = [],
  movies = [],
  shots = "/tmp/mm-identity-screenshots",
  capture = process.env.IDENTITY_SCREENSHOTS === "1";
if (capture) await mkdir(shots, { recursive: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    reducedMotion: "reduce",
    acceptDownloads: true,
  });
  await context.addInitScript(() => {
    if (!["http:", "https:"].includes(location.protocol)) return;
    localStorage.setItem("mg_season_mode", "off");
    localStorage.setItem("mg_ambient_canvas", "false");
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
      if (window.__failCardPng) {
        window.__failCardPng = false;
        callback(null);
        return;
      }
      return original.call(this, callback, ...args);
    };
  });
  const stamp = Date.now(),
    response = await context.request.post(base + "/api/auth", {
      data: {
        action: "register",
        username: "Identity" + stamp,
        email: `identity-${stamp}@example.test`,
        password: "isolated-identity-password",
      },
    });
  assert.equal(response.status(), 200);
  const me = (await response.json()).user;
  users.push(me.id);
  for (let i = 0; i < 5; i++)
    movies.push(
      (
        await db.query(
          "insert into mg_movies(title,description,category,genre,year,duration,poster,country) values($1,'Identity fixture','Фильм','Драма',2020,120,'/brand/moviemovie-logo.png','Япония') returning id",
          [`Идентичность ${me.id} ${i}`],
        )
      ).rows[0].id,
    );
  for (const id of [...movies, movies[0]])
    await db.query("insert into mg_watches(user_id,movie_id) values($1,$2)", [
      me.id,
      id,
    ]);
  const before = (
    await db.query("select xp from mg_users where id=$1", [me.id])
  ).rows[0].xp;
  const page = await context.newPage(),
    errors = [],
    posts = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/action" && r.method() === "POST")
      posts.push(r.postDataJSON());
  });
  const load = async (tab) => {
    await page.goto(base + "/profile");
    await page.waitForFunction(
      () =>
        document.querySelector(".app-shell")?.getAttribute("data-hud-busy") ===
          "false" && document.querySelector(".personal-profile"),
    );
    await page
      .getByRole("navigation", { name: "Разделы профиля" })
      .getByRole("button", { name: tab, exact: true })
      .click();
  };
  const titles = page.locator(".identity-titles"),
    card = page.locator(".identity-card-dialog");
  const option = (id) =>
    titles
      .locator(".user-title-option")
      .filter({ has: page.getByLabel(`Титул: ${id}`, { exact: true }) });
  await load("Титулы");
  await titles.waitFor();
  assert.equal(await titles.locator(".user-title-option").count(), 10);
  assert.match(
    await titles.locator(".identity-title-count").innerText(),
    /2 \/ 10/,
  );
  assert.match(
    await titles.locator(".identity-next-title").innerText(),
    /Мастер кадров/,
  );
  await titles.getByRole("button", { name: "Открытые 2", exact: true }).click();
  assert.equal(await titles.locator(".user-title-option").count(), 2);
  await titles
    .getByRole("button", { name: "Ещё впереди 8", exact: true })
    .click();
  assert.equal(await titles.locator(".user-title-option").count(), 8);
  assert.equal(
    await titles.locator(".user-title-option > button:not(:disabled)").count(),
    0,
  );
  const locked = await context.request.post(base + "/api/action", {
    data: { action: "titleEquip", titleId: "screen_legend" },
  });
  assert.equal(locked.status(), 400);
  await titles.getByRole("button", { name: "Все 10", exact: true }).click();
  // Failed saves must leave the previous server-owned selection visible and offer retry.
  await page.route("**/api/action", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Isolated failure" }),
    }),
  );
  await option("Киноискатель")
    .getByRole("button", { name: "Носить титул" })
    .click();
  await titles.getByRole("alert").waitFor();
  assert.equal(
    (await db.query("select equipped_title from mg_users where id=$1", [me.id]))
      .rows[0].equipped_title,
    null,
  );
  assert.equal(
    await titles.locator(".user-title-modes button[aria-pressed=true]").count(),
    1,
  );
  await page.unroute("**/api/action");
  await titles.getByRole("button", { name: "Повторить сохранение" }).click();
  await option("Киноискатель")
    .getByRole("button", { name: "Активен", exact: true })
    .waitFor();
  assert.equal(
    (await db.query("select equipped_title from mg_users where id=$1", [me.id]))
      .rows[0].equipped_title,
    "seeker",
  );
  await load("Титулы");
  await option("Киноискатель")
    .getByRole("button", { name: "Активен", exact: true })
    .waitFor();
  // Permanent ownership survives deletion of history, and automatic/none remain real choices.
  await db.query("delete from mg_watches where user_id=$1", [me.id]);
  await load("Титулы");
  assert.equal(
    await option("Киноискатель")
      .getByRole("button", { name: "Активен", exact: true })
      .count(),
    1,
  );
  await titles.getByRole("button", { name: /^Без титула Только/ }).click();
  await page.waitForFunction(
    () =>
      document.querySelector(".identity-title-person small")?.textContent ===
      "Без титула",
  );
  assert.equal(
    (await db.query("select equipped_title from mg_users where id=$1", [me.id]))
      .rows[0].equipped_title,
    "none",
  );
  await titles.getByRole("button", { name: /^Автоматически/ }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector(".user-title-modes button[aria-pressed=true]")
        ?.textContent?.includes("Автоматически") === true &&
      document
        .querySelector(".identity-title-person .user-title-badge")
        ?.textContent?.includes("Киноискатель") === true,
  );
  for (const theme of ["dark", "light", "pink", "purple", "yellow"]) {
    await page.evaluate(
      (t) => (document.documentElement.dataset.theme = t),
      theme,
    );
    for (const width of [320, 390, 560, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1050 });
      await titles.scrollIntoViewIfNeeded();
      assert(
        await titles.evaluate(
          (el) => el.getBoundingClientRect().right <= innerWidth + 1,
        ),
        `${theme}/${width}/title bounds`,
      );
      assert(
        await titles.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        `${theme}/${width}/title contents`,
      );
      if (
        capture &&
        ["dark", "light"].includes(theme) &&
        [390, 1440].includes(width)
      )
        await page.screenshot({
          path: `${shots}/titles-${theme}-${width}.png`,
          fullPage: true,
        });
    }
  }
  // Exercise empty locked collection without inventing new progression or rewards.
  for (const id of [
    "beginner",
    "seeker",
    "frame_master",
    "screen_legend",
    "connoisseur",
    "archivist",
    "universe_keeper",
    "marvel_advocate",
    "arthouse_king",
    "serial_spoiler",
  ])
    await db.query(
      "insert into mg_user_title_awards(user_id,title_id)values($1,$2) on conflict do nothing",
      [me.id, id],
    );
  await load("Титулы");
  await titles
    .getByRole("button", { name: "Ещё впереди 0", exact: true })
    .click();
  await titles.locator(".identity-title-empty").waitFor();
  assert.match(
    await titles.locator(".identity-next-title").innerText(),
    /Все зрительские титулы открыты/,
  );
  await titles.getByRole("button", { name: "Показать все титулы" }).click();
  assert.equal(await titles.locator(".user-title-option").count(), 10);
  // Restore the real watch fixture for artwork. Repeats contribute to card time, not title ranks.
  for (const id of [...movies, movies[0]])
    await db.query("insert into mg_watches(user_id,movie_id)values($1,$2)", [
      me.id,
      id,
    ]);
  await load("Киновизитка");
  const launch = page.getByRole("button", { name: "Создать визитку" });
  await launch.click();
  await card.waitFor();
  assert.equal(await card.evaluate((el) => el.matches(":modal")), true);
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.body).overflow),
    "hidden",
  );
  await page.keyboard.press("Escape");
  await card.waitFor({ state: "detached" });
  assert.equal(
    await launch.evaluate((el) => el === document.activeElement),
    true,
  );
  // Logo load failure recovers inside the dialog, without a forced close.
  const logoPattern = "**/*moviemovie-logo*.png";
  await page.route(logoPattern, (route) => route.abort());
  await launch.click();
  await card
    .getByRole("button", { name: "Повторить подготовку PNG" })
    .waitFor();
  assert.equal(
    await card.getByRole("button", { name: /Скачать PNG/ }).isDisabled(),
    true,
  );
  await page.unroute(logoPattern);
  await card.getByRole("button", { name: "Повторить подготовку PNG" }).click();
  const ready = async () => {
    await page.waitForFunction(() => {
      const c = document.querySelector(".identity-card-dialog");
      return (
        c &&
        [...c.querySelectorAll("button")].some(
          (b) => b.textContent.includes("Скачать") && !b.disabled,
        ) &&
        c.querySelector(".cinema-studio-preview img")?.complete
      );
    });
  };
  await ready();
  assert.match(
    await card.locator(".cinema-studio-preview img").getAttribute("alt"),
    /12 ч 0 мин/,
  );
  // PNG encoding failure and retry, with the same selected design.
  await page.evaluate(() => (window.__failCardPng = true));
  await card.locator(".cinema-theme-options button").nth(1).click();
  await card
    .getByRole("button", { name: "Повторить подготовку PNG" })
    .waitFor();
  assert.equal(
    await card.getByRole("button", { name: /Скачать PNG/ }).isDisabled(),
    true,
  );
  await card.getByRole("button", { name: "Повторить подготовку PNG" }).click();
  await ready();
  for (const format of ["square", "story"]) {
    await card
      .locator(`.cinema-format-options button:has(.shape-${format})`)
      .click();
    for (let theme = 0; theme < 3; theme++) {
      await card.locator(".cinema-theme-options button").nth(theme).click();
      await ready();
      const pending = page.waitForEvent("download");
      await card.getByRole("button", { name: /Скачать PNG/ }).click();
      const download = await pending;
      const bytes = await readFile(await download.path());
      assert.equal(bytes.subarray(1, 4).toString(), "PNG");
      assert.equal(bytes.readUInt32BE(16), 1080);
      assert.equal(bytes.readUInt32BE(20), format === "square" ? 1080 : 1920);
      assert.match(
        download.suggestedFilename(),
        new RegExp(`-${format}\\.png$`),
      );
    }
  }
  for (const theme of ["dark", "light"]) {
    await page.evaluate(
      (t) => (document.documentElement.dataset.theme = t),
      theme,
    );
    for (const width of [320, 390, 560, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const format of ["square", "story"]) {
        await card
          .locator(`.cinema-format-options button:has(.shape-${format})`)
          .click();
        await ready();
        assert(
          await card.evaluate(
            (el) =>
              el.getBoundingClientRect().left >= 0 &&
              el.getBoundingClientRect().right <= innerWidth + 1 &&
              el.scrollWidth <= el.clientWidth + 1,
          ),
          `${theme}/${width}/${format}/dialog bounds`,
        );
        assert(
          await card.locator(".cinema-studio-preview img").evaluate((el) => {
            const p = el.parentElement.getBoundingClientRect(),
              b = el.getBoundingClientRect();
            return b.left >= p.left && b.right <= p.right + 1;
          }),
          `${width}/${format}/preview bounds`,
        );
        if (capture && [390, 1440].includes(width)) {
          await card.evaluate((el) => (el.scrollTop = 0));
          await page.screenshot({
            path: `${shots}/card-${theme}-${width}-${format}.png`,
          });
        }
      }
    }
  }
  await card.evaluate((el) => (el.scrollTop = el.scrollHeight));
  const shared = page.waitForEvent("download");
  await card.getByRole("button", { name: "Поделиться визиткой" }).click();
  assert.match((await shared).suggestedFilename(), /\.png$/);
  assert.match(
    await card.locator(".cinema-studio-status").innerText(),
    /PNG скачан/,
  );
  assert.match(
    await card.locator(".cinema-social-actions a").first().getAttribute("href"),
    /t\.me\/share\/url/,
  );
  // Exercise browser capability boundaries without opening external applications.
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Denied");
        },
      },
    });
  });
  await card.getByRole("button", { name: "Текст", exact: true }).click();
  assert.match(
    await card.locator(".cinema-studio-status").innerText(),
    /Буфер обмена недоступен/,
  );
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data) => {
        const file = data.files[0];
        window.__nativeShare = {
          name: file.name,
          type: file.type,
          size: file.size,
          text: data.text,
        };
      },
    });
  });
  await card.getByRole("button", { name: "Поделиться визиткой" }).click();
  await page.waitForFunction(() => !!window.__nativeShare);
  const nativeShare = await page.evaluate(() => window.__nativeShare);
  assert.equal(nativeShare.type, "image/png");
  assert(nativeShare.size > 1000);
  assert(!nativeShare.text.includes("@example.test"));
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        throw new Error("Unavailable");
      },
    }),
  );
  await card.getByRole("button", { name: "Поделиться визиткой" }).click();
  assert.match(
    await card.locator(".cinema-studio-status").innerText(),
    /Не удалось отправить/,
  );
  await card.getByRole("button", { name: "Закрыть кино-визитку" }).click();
  assert.equal(
    await launch.evaluate((el) => el === document.activeElement),
    true,
  );
  assert.notEqual(
    await page.evaluate(() => getComputedStyle(document.body).overflow),
    "hidden",
  );
  await launch.click();
  await ready();
  // Native dialog keeps focus inside even when keyboard tabbing wraps around.
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    assert(await card.evaluate((el) => el.contains(document.activeElement)));
  }
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Shift+Tab");
    assert(await card.evaluate((el) => el.contains(document.activeElement)));
  }
  await page.keyboard.press("Escape");
  await launch.click();
  await ready();
  await card.locator(".cinema-crown-link").click();
  await page.waitForURL(base + "/achievements");
  await card.waitFor({ state: "detached" });
  assert.notEqual(
    await page.evaluate(() => getComputedStyle(document.body).overflow),
    "hidden",
  );
  const guest = await browser.newContext(),
    g = await guest.newPage();
  await g.goto(base + "/profile");
  await g.getByRole("heading", { name: "Твоя киновселенная ждёт" }).waitFor();
  assert.equal(
    await g.locator(".identity-titles,.identity-card-entry").count(),
    0,
  );
  await guest.close();
  assert.equal(
    (await db.query("select xp from mg_users where id=$1", [me.id])).rows[0].xp,
    before,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from mg_popcorn_ledger where user_id=$1",
        [me.id],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from mg_watches where user_id=$1",
        [me.id],
      )
    ).rows[0].n,
    6,
  );
  assert(posts.every((p) => p.action === "titleEquip"));
  assert.deepEqual(errors, []);
  console.log(
    "PASS profile identity: title filters, locked server rejection, failed-save retry, persisted equip/none/auto, permanent ownership and completed collection; real 6 PNG exports and native-share fallback, logo/encoding recovery, native modal keyboard/focus/scroll lock, 5 themes and 6 viewport widths, guest privacy, no XP/popcorn/watch mutations.",
  );
  await context.close();
} finally {
  await browser.close();
  for (const table of [
    "mg_watches",
    "mg_ratings",
    "mg_hidden_achievement_awards",
    "mg_hidden_achievement_events",
    "mg_user_title_awards",
  ])
    await db.query(`delete from ${table} where user_id=any($1::int[])`, [
      users,
    ]);
  await db.query(
    "delete from mg_notifications where user_id=any($1::int[]) or actor_id=any($1::int[])",
    [users],
  );
  await db.query("delete from mg_movies where id=any($1::int[])", [movies]);
  await db.query("delete from mg_users where id=any($1::int[])", [users]);
  await db.end();
}
