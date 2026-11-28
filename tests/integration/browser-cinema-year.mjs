// Production UI + authenticated API; only the isolated marker-guarded local audit database.
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
  year = new Date().getUTCFullYear(),
  shots = "/tmp/mm-year-screenshots";
const capture = process.env.YEAR_SCREENSHOTS === "1";
if (capture) await mkdir(shots, { recursive: true });
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
      acceptDownloads: true,
    }),
    peer = await browser.newContext(),
    guest = await browser.newContext();
  await context.addInitScript(() => {
    if (location.protocol !== "http:" && location.protocol !== "https:") return;
    localStorage.setItem("mg_season_mode", "off");
    localStorage.setItem("mg_ambient_canvas", "false");
  });
  const register = async (ctx, prefix) => {
    const stamp = Date.now() + users.length,
      r = await ctx.request.post(base + "/api/auth", {
        data: {
          action: "register",
          username: prefix + stamp,
          email: `${prefix}-${stamp}@example.test`,
          password: "isolated-yearbook-password",
        },
      });
    assert.equal(r.status(), 200);
    const u = (await r.json()).user;
    users.push(u.id);
    return u;
  };
  const me = await register(context, "Year"),
    other = await register(peer, "OtherYear");
  for (const [index, category, duration, episodes] of [
    [0, "Фильм", 120, null],
    [1, "Сериал", 45, 4],
    [2, "Фильм", 90, null],
  ])
    movies.push(
      (
        await db.query(
          "insert into mg_movies(title,description,category,genre,year,duration,episodes,poster,country) values($1,'Yearbook isolated fixture',$2,'Драма',$3,$4,$5,'/brand/moviemovie-logo.png','Япония') returning id",
          [`Глава ${index} ${me.id}`, category, year, duration, episodes],
        )
      ).rows[0].id,
    );
  await db.query(
    "insert into mg_watches(user_id,movie_id,watched_at) values($1,$2,$5),($1,$2,$6),($1,$3,$7),($1,$4,$8)",
    [
      me.id,
      ...movies,
      `${year}-01-01T00:00:00Z`,
      `${year}-01-02T12:00:00Z`,
      `${year}-03-10T12:00:00Z`,
      `${year - 1}-12-31T23:59:59Z`,
    ],
  );
  await db.query(
    "insert into mg_watches(user_id,movie_id,watched_at)values($1,$2,$3)",
    [other.id, movies[2], `${year}-05-01T12:00:00Z`],
  );
  await db.query(
    "insert into mg_ratings(user_id,movie_id,value)values($1,$2,8),($1,$3,6),($4,$2,10)",
    [me.id, movies[0], movies[1], other.id],
  );
  const getYear = async (value) => {
    const response = await context.request.get(
      base + `/api/wrapped?year=${value}`,
    );
    assert.equal(response.status(), 200);
    assert.match(response.headers()["cache-control"], /private.*no-store/);
    return response.json();
  };
  const actual = await getYear(year),
    previous = await getYear(year - 1);
  assert.equal(actual.watches, 3);
  assert.equal(actual.uniqueMovies, 2);
  assert.equal(actual.minutes, 420);
  assert.equal(actual.hours, 7);
  assert.equal(actual.averageRating, 7);
  assert.equal(actual.bestMovie.id, movies[0]);
  assert.equal(actual.months[0], 2);
  assert.equal(actual.months[2], 1);
  assert.equal(
    actual.months.reduce((a, b) => a + b, 0),
    3,
  );
  assert.equal(previous.watches, 1);
  assert.equal(previous.averageRating, null);
  assert.equal((await guest.request.get(base + "/api/wrapped")).status(), 401);
  const before = (
    await db.query("select xp from mg_users where id=$1", [me.id])
  ).rows[0].xp;
  const page = await context.newPage(),
    errors = [],
    posts = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (r.method() === "POST")
      posts.push({ path: new URL(r.url()).pathname, body: r.postData() });
  });
  let fail = true;
  await page.route("**/api/wrapped?year=*", async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({
        status: 503,
        json: { error: "fixture unavailable" },
      });
    } else await route.continue();
  });
  await page.goto(base + "/profile");
  await page.waitForFunction(
    () =>
      document.querySelector(".app-shell")?.getAttribute("data-hud-busy") ===
      "false",
  );
  await page.goto(base + "/wrapped");
  await page.waitForFunction(
    () =>
      document.querySelector(".app-shell")?.getAttribute("data-hud-busy") ===
        "false" && document.querySelectorAll(".cinema-year").length === 1,
  );
  const hub = page.locator(".cinema-year"),
    story = page.locator("dialog.ww-cinema-story"),
    share = page.locator("dialog.cinema-year-share");
  await hub.getByRole("alert").waitFor();
  await hub
    .getByRole("button", { name: "Повторить загрузку", exact: true })
    .click();
  await hub.locator(".year-main-grid").waitFor();
  assert.deepEqual(await hub.locator(".year-summary dd").allTextContents(), [
    "3",
    "7",
    "7",
  ]);
  assert.equal(
    await page.locator("dialog[open]").count(),
    0,
    "Landing does not launch an overlay or export automatically",
  );
  const select = hub.getByRole("combobox", { name: "Год итогов", exact: true });
  await select.selectOption(String(year - 1));
  await page.waitForFunction(
    () => document.querySelector(".year-summary dd")?.textContent === "1",
  );
  assert.match(await hub.locator(".year-summary").innerText(), /Нет оценок/);
  await select.selectOption("2000");
  await hub.locator(".year-empty").waitFor();
  assert.equal(await hub.locator(".year-chapter").count(), 0);
  await select.selectOption(String(year));
  await hub.locator(".year-main-grid").waitFor();
  // A delayed previous-year response cannot replace the newly selected year.
  let started;
  const oldStarted = new Promise((resolve) => {
    started = resolve;
  });
  await page.route(`**/api/wrapped?year=${year - 1}`, async (route) => {
    started();
    await new Promise((r) => setTimeout(r, 350));
    try {
      await route.fulfill({ status: 200, json: previous });
    } catch {
      /* Aborted by the newer selection. */
    }
  });
  await select.selectOption(String(year - 1));
  await oldStarted;
  await select.selectOption(String(year));
  await page.waitForFunction(
    () => document.querySelector(".year-summary dd")?.textContent === "3",
  );
  await page.waitForTimeout(400);
  assert.equal(await select.inputValue(), String(year));
  assert.equal(await hub.locator(".year-summary dd").first().innerText(), "3");
  await page.unroute(`**/api/wrapped?year=${year - 1}`);
  const openChapter = async (index) => {
    await hub.locator(".year-chapter").nth(index).click();
    await story.locator(".ww-slide").waitFor();
  };
  // Story errors can be retried without losing the year or closing the route.
  fail = true;
  await hub.locator(".year-chapter").nth(1).click();
  await story.getByRole("alert").waitFor();
  await story
    .getByRole("button", { name: "Повторить загрузку", exact: true })
    .click();
  await story.locator(".ww-time").waitFor();
  assert.equal(await page.locator("dialog[open]").count(), 1);
  await page.keyboard.press("ArrowRight");
  await story.locator(".ww-watches").waitFor();
  await page.keyboard.press("ArrowLeft");
  await story.locator(".ww-time").waitFor();
  const swipe = async (selector, start, end, cancel = false) =>
    page.evaluate(
      ({ selector, start, end, cancel }) => {
        const target = document.querySelector(selector);
        const first = new Event("touchstart", { bubbles: true });
        Object.defineProperty(first, "touches", {
          value: [{ clientX: start[0], clientY: start[1] }],
        });
        target.dispatchEvent(first);
        if (cancel)
          target.dispatchEvent(new Event("touchcancel", { bubbles: true }));
        const last = new Event("touchend", { bubbles: true });
        Object.defineProperty(last, "changedTouches", {
          value: [{ clientX: end[0], clientY: end[1] }],
        });
        target.dispatchEvent(last);
      },
      { selector, start, end, cancel },
    );
  await swipe(".ww-stage", [300, 200], [100, 210]);
  await story.locator(".ww-watches").waitFor();
  await swipe(".ww-stage", [100, 200], [300, 210]);
  await story.locator(".ww-time").waitFor();
  await swipe(".ww-stage", [300, 200], [150, 600]);
  await swipe(".ww-stage", [300, 200], [100, 210], true);
  await swipe(".ww-share-shortcut svg", [300, 200], [100, 210]);
  assert.equal(
    await story.locator(".ww-time").count(),
    1,
    "Vertical/cancelled gestures and touches on SVG controls do not turn pages",
  );
  await story
    .getByRole("combobox", { name: "Выбрать год", exact: true })
    .focus();
  await page.keyboard.press("ArrowLeft");
  assert.equal(
    await story.locator(".ww-time").count(),
    1,
    "Year-select arrow keys do not turn story pages",
  );
  await story
    .getByRole("button", { name: "Создать карточку этой главы", exact: true })
    .click();
  await share
    .getByRole("button", { name: "Скачать PNG", exact: true })
    .waitFor();
  assert(
    (await share
      .getByRole("button", { name: /Время в кино/ })
      .getAttribute("aria-pressed")) === "true",
  );
  const step = await story
    .locator(".ww-progress-item[aria-current]")
    .getAttribute("aria-label");
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await story
      .locator(".ww-progress-item[aria-current]")
      .getAttribute("aria-label"),
    step,
    "Nested share dialog does not navigate the underlying story",
  );
  const renderChoice = async (name) => {
    const previous = await page.evaluate(
      () =>
        document.querySelector(".wshare-preview img")?.getAttribute("src") ||
        null,
    );
    await share.getByRole("button", { name, exact: true }).click();
    await page.waitForFunction((previous) => {
      const image = document.querySelector(".wshare-preview img");
      return (
        image instanceof HTMLImageElement &&
        image.complete &&
        image.naturalWidth > 0 &&
        image.getAttribute("src") !== previous &&
        !document.querySelector(".wshare-primary")?.disabled
      );
    }, previous);
  };
  // Verify the actual downloaded PNG bytes for all three existing output formats.
  for (const [label, width, height, format] of [
    ["История", 1080, 1920, "story"],
    ["Пост", 1080, 1350, "post"],
    ["Квадрат", 1080, 1080, "square"],
  ]) {
    await renderChoice(label);
    const download = page.waitForEvent("download");
    await share
      .getByRole("button", { name: "Скачать PNG", exact: true })
      .click();
    const file = await download;
    assert.match(
      file.suggestedFilename(),
      new RegExp(`wrapped-${year}-time-${format}\\.png$`),
    );
    const png = await readFile(await file.path());
    assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), width);
    assert.equal(png.readUInt32BE(20), height);
  }
  for (const label of ["Мой киногод", "Мой жанр", "Фильм года", "Достижения"]) {
    await renderChoice(new RegExp(label));
    await share.locator(".wshare-preview img").waitFor();
  }
  await share
    .getByRole("button", { name: "Поделиться изображением", exact: true })
    .click();
  await share.getByRole("status").waitFor();
  // Native focus containment, topmost Escape, trigger restoration and scroll unlock.
  await share.getByRole("button", { name: "Закрыть", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  assert(
    await page.evaluate(
      () =>
        document.activeElement?.closest("dialog.cinema-year-share") !== null,
    ),
  );
  await page.keyboard.press("Escape");
  await share.waitFor({ state: "detached" });
  assert(await story.isVisible());
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    ),
    "Создать карточку этой главы",
  );
  await story
    .getByRole("combobox", { name: "Выбрать год", exact: true })
    .selectOption("2000");
  await story
    .getByRole("heading", { name: "Пока без титров.", exact: true })
    .waitFor();
  await story
    .getByRole("combobox", { name: "Выбрать год", exact: true })
    .selectOption(String(year - 1));
  await story.locator(".ww-time").waitFor();
  await story
    .getByRole("combobox", { name: "Выбрать год", exact: true })
    .selectOption(String(year));
  await story.locator(".ww-time").waitFor();
  await page.keyboard.press("Escape");
  await story.waitFor({ state: "detached" });
  await hub.locator(".year-main-grid").waitFor();
  assert.equal(await select.inputValue(), String(year));
  assert.notEqual(
    await page.evaluate(() => getComputedStyle(document.body).overflow),
    "hidden",
  );
  assert(
    await page.evaluate(
      () => !!document.activeElement?.matches(".year-heading h1"),
    ),
  );
  // All nine chapters are directly reachable and stay inside the viewport, including short screens.
  for (const width of [320, 390, 760, 1000, 1440]) {
    await page.setViewportSize({ width, height: 740 });
    await openChapter(0);
    for (let index = 0; index < 9; index++) {
      await story
        .locator(".ww-progress-item")
        .nth(index)
        .evaluate((button) => button.click());
      await page.waitForFunction(
        (i) =>
          document
            .querySelectorAll(".ww-slide")[0]
            ?.getAttribute("class")
            ?.includes(
              [
                "ww-intro",
                "ww-time",
                "ww-watches",
                "ww-genres",
                "ww-ratings",
                "ww-best",
                "ww-months",
                "ww-challenges",
                "ww-final",
              ][i],
            ),
        index,
      );
      const geometry = await story.evaluate((root) => ({
        scroll: root.scrollWidth,
        width: root.clientWidth,
        bad: [...root.querySelectorAll("button,select")]
          .filter((e) => {
            if (!e.getClientRects().length) return false;
            const r = e.getBoundingClientRect();
            return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
          })
          .map((e) => e.textContent.trim()),
      }));
      assert(
        geometry.scroll <= geometry.width + 1,
        `${width}/chapter${index} horizontal overflow`,
      );
      assert.deepEqual(
        geometry.bad,
        [],
        `${width}/chapter${index} offscreen controls`,
      );
    }
    const finalActions = await story.locator(".ww-final").evaluate((slide) => {
      slide.scrollTop = slide.scrollHeight;
      const finish = slide
        .querySelector(".ww-final-actions button:last-child")
        .getBoundingClientRect();
      const nav = document
        .querySelector(".ww-navigation")
        .getBoundingClientRect();
      return { finish: finish.bottom, nav: nav.top };
    });
    assert(
      finalActions.finish <= finalActions.nav + 1,
      `${width}/final actions must scroll clear of the fixed navigation`,
    );
    await page.keyboard.press("Escape");
    await story.waitFor({ state: "detached" });
  }
  // The entrance is usable across every site theme and responsive shell width.
  for (const theme of ["dark", "light", "pink", "purple", "yellow"]) {
    await page.evaluate(
      (t) => (document.documentElement.dataset.theme = t),
      theme,
    );
    for (const width of [320, 360, 390, 600, 760, 1000, 1182, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(80);
      assert(
        await hub.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth + 1,
        ),
        `${theme}/${width}/hub overflow`,
      );
      if (
        capture &&
        ["dark", "light"].includes(theme) &&
        [390, 1440].includes(width)
      ) {
        await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
        await page.screenshot({ path: `${shots}/${theme}-${width}.png` });
      }
    }
  }
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      HTMLCanvasElement.prototype.toBlob = original;
      callback(null);
    };
  });
  await hub
    .getByRole("button", { name: "Создать карточку", exact: true })
    .click();
  await share
    .getByRole("button", { name: "Повторить создание", exact: true })
    .click();
  await share.locator(".wshare-preview img").waitFor();
  assert.equal(
    await page.locator("dialog[open]").count(),
    1,
    "Direct export does not open the story",
  );
  for (const width of [320, 390, 700, 1000, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(120);
    const previewBounds = await share.evaluate((root) => {
      const image = root
        .querySelector(".wshare-preview img")
        .getBoundingClientRect();
      const frame = root
        .querySelector(".wshare-preview")
        .getBoundingClientRect();
      const modal = root.querySelector(".wshare-modal").getBoundingClientRect();
      return {
        fits:
          image.top >= frame.top - 1 &&
          image.bottom <= frame.bottom + 1 &&
          image.left >= frame.left - 1 &&
          image.right <= frame.right + 1,
        modalFits: modal.top >= -1 && modal.bottom <= innerHeight + 1,
      };
    });
    assert(previewBounds.fits, `${width}/PNG preview stays inside its frame`);
    assert(
      previewBounds.modalFits,
      `${width}/export dialog stays inside viewport`,
    );
  }
  await page.evaluate(() => (document.documentElement.dataset.theme = "light"));
  assert.equal(
    await share
      .locator(".wshare-primary")
      .evaluate((button) => getComputedStyle(button).color),
    "rgb(255, 255, 255)",
    "Light-theme export action keeps readable white text on its dark accent",
  );
  await page.goBack();
  await share.waitFor({ state: "detached" });
  assert.notEqual(
    await page.evaluate(() => getComputedStyle(document.body).overflow),
    "hidden",
    "Route exit cannot leave the body locked",
  );
  const g = await guest.newPage();
  await g.goto(base + "/wrapped");
  await g
    .getByRole("button", { name: "Войти или зарегистрироваться", exact: true })
    .waitFor();
  assert.equal(await g.locator(".cinema-year").count(), 0);
  assert.deepEqual(
    posts,
    [],
    "Yearbook browsing and export must not mutate watches, activity, or wallet",
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from mg_watches where user_id=$1",
        [me.id],
      )
    ).rows[0].n,
    4,
  );
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
  assert.deepEqual(errors, []);
  console.log(
    "PASS cinema year: real UTC-scoped own data, repeated watches/episodic time/current ratings, year switching/empty/stale and error recovery; nine story chapters ×5 widths, keyboard and nested modal focus/Escape; real PNG downloads in all three formats/all card previews; 5 themes ×8 entrance widths; guest privacy; no watches, XP or popcorn mutations.",
  );
  await context.close();
  await peer.close();
  await guest.close();
} finally {
  await browser.close();
  for (const table of [
    "mg_watches",
    "mg_ratings",
    "mg_hidden_achievement_awards",
    "mg_hidden_achievement_events",
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
