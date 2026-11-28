// Real production app and a marker-guarded disposable local database only.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { Client } from "pg";
import { chooseTheme } from "./settings-controls.mjs";
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
  films = [],
  challengeIds = [],
  shots = "/tmp/mm-play-screenshots";
await mkdir(shots, { recursive: true });
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    }),
    guest = await browser.newContext({
      viewport: { width: 390, height: 900 },
      reducedMotion: "reduce",
    });
  for (const ctx of [context, guest])
    await ctx.addInitScript(() => {
      localStorage.setItem("mg_season_mode", "off");
      localStorage.setItem("mg_ambient_canvas", "false");
    });
  const stamp = Date.now();
  const signup = await context.request.post(base + "/api/auth", {
    data: {
      action: "register",
      email: `practice-${stamp}@example.test`,
      username: "Practice" + stamp,
      password: "isolated-cinema-play-password",
    },
  });
  assert.equal(signup.status(), 200);
  const me = (await signup.json()).user;
  users.push(me.id);
  const names = [
    "Альфа",
    "Бета",
    "Гамма",
    "Дельта",
    "Эпсилон",
    "Зета",
    "Эта",
    "Тета",
    "Йота",
    "Каппа",
  ];
  for (let i = 0; i < 10; i++) {
    const id = (
      await db.query(
        "insert into mg_movies(title,original_title,description,category,genre,year,duration,poster,director,country)values($1,$2,$3,$4,$5,$6,$7,'/brand/moviemovie-logo.png',$8,$9)returning id",
        [
          names[i] + " " + stamp,
          "Original " + i + " " + stamp,
          "Уникальная история для тренировки " + i,
          [
            "Фильм",
            "Сериал",
            "Аниме-сериал",
            "Мультфильм",
            "Мультсериал",
            "Аниме-фильм",
          ][i % 6],
          i < 3
            ? "Драма"
            : [
                "Комедия",
                "Триллер",
                "Фантастика",
                "Боевик",
                "Ужасы",
                "Детектив",
                "Мелодрама",
              ][i - 3],
          1940 + i,
          80 + i * 5,
          "Режиссёр " + i,
          "Страна " + i,
        ],
      )
    ).rows[0].id;
    films.push(id);
    await db.query(
      "insert into mg_ratings(user_id,movie_id,value)values($1,$2,$3)",
      [me.id, id, 1 + i / 2],
    );
  }
  await db.query(
    "insert into mg_watches(user_id,movie_id,watched_at)values($1,$2,now()-interval '4 days')",
    [me.id, films[0]],
  );
  // Seed the full calendar only for this suite, then let the real watch action award completion.
  const currentMonth = new Date().getUTCMonth() + 1;
  for (let month = 1; month <= 12; month++)
    challengeIds.push(
      (
        await db.query(
          "insert into mg_challenges(title,description,month,filter_genre,filter_category,target,xp_reward,icon)values($1,'Посмотри три фильма в жанре драма.',$2,'Драма','Фильм',3,300,'🎬')returning id",
          ["Драматургия месяца " + month, month],
        )
      ).rows[0].id,
    );
  challengeIds.push(
    (
      await db.query(
        "insert into mg_challenges(title,description,month,target,xp_reward,icon)values('Первый сеанс месяца','Посмотри одну историю в этом месяце.',$1,1,100,'✦')returning id",
        [currentMonth],
      )
    ).rows[0].id,
  );
  assert.equal(
    (
      await context.request.post(base + "/api/action", {
        data: { action: "watch", movieId: films[6] },
      })
    ).status(),
    200,
  );
  const awarded = (
    await db.query("select xp from mg_users where id=$1", [me.id])
  ).rows[0].xp;
  assert.equal(
    (
      await context.request.post(base + "/api/action", {
        data: { action: "watch", movieId: films[6] },
      })
    ).status(),
    200,
  );
  assert.equal(
    (await db.query("select xp from mg_users where id=$1", [me.id])).rows[0].xp,
    awarded,
    "A repeated watch must not re-award a challenge",
  );
  const completed = (
    await db.query(
      "select completed,reward_claimed from mg_challenge_progress where user_id=$1 and challenge_id=$2",
      [me.id, challengeIds.at(-1)],
    )
  ).rows[0];
  assert(completed.completed && completed.reward_claimed);
  const page = await context.newPage(),
    anon = await guest.newPage(),
    errors = [];
  let gamePosts = 0,
    guestPosts = 0;
  for (const p of [page, anon])
    p.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (
      r.url().endsWith("/api/action") &&
      r.method() === "POST" &&
      r.postDataJSON()?.action === "game"
    )
      gamePosts++;
  });
  anon.on("request", (r) => {
    if (r.url().endsWith("/api/action") && r.method() === "POST") guestPosts++;
  });
  async function load(p, path, selector) {
    assert.equal((await p.goto(base + path)).status(), 200);
    // Games are SSR-rendered before the authenticated/fixture data refresh settles.
    await p.locator('.app-shell[data-hud-busy="false"]').waitFor();
    await p.locator(selector).first().waitFor();
  }
  async function finish(p) {
    for (let i = 0; i < 5; i++) {
      assert.equal(await p.locator(".game-options button").count(), 4);
      await p.locator(".game-options button").first().click();
      await p.locator(".game-next button").click();
    }
    await p.locator(".game-result").waitFor();
  }
  await load(anon, "/games", ".game-card");
  assert.equal(await anon.locator(".game-card").count(), 16);
  await anon.locator(".game-card").first().click();
  await finish(anon);
  assert.equal(guestPosts, 0);
  assert.match(await anon.locator(".game-result").innerText(), /Войди/);
  await anon.keyboard.press("Escape");
  assert.equal(await anon.locator("dialog[open]").count(), 0);
  await load(anon, "/achievements", ".gate");
  assert.match(await anon.locator("main").innerText(), /Войти/);
  await load(anon, "/challenges", ".gate");
  // Insufficient catalog: explicit status, not a malformed round or fabricated answer.
  await guest.route("**/api/data", async (r) => {
    const response = await r.fetch();
    const data = await response.json();
    data.films = data.films.slice(0, 2);
    await r.fulfill({ response, json: data });
  });
  await load(anon, "/games", ".game-card");
  await anon.locator(".game-card").first().click();
  await anon
    .getByRole("alert")
    .filter({ hasText: "недостаточно данных" })
    .waitFor();
  assert.equal(await anon.locator(".game-options").count(), 0);
  await guest.unroute("**/api/data");
  await load(page, "/games", ".game-card");
  const initial = await (await context.request.get(base + "/api/data")).json();
  const xp = initial.user.xp;
  await page.getByRole("button", { name: "Знать детали", exact: true }).click();
  assert.equal(await page.locator(".game-card").count(), 6);
  await page.getByRole("button", { name: "Все игры", exact: true }).click();
  await page.getByRole("textbox", { name: "Найти игру" }).fill("хроно");
  assert.equal(await page.locator(".game-card").count(), 2);
  await page.getByRole("textbox", { name: "Найти игру" }).fill("НЕТ_ТАКОЙ");
  assert.equal(await page.locator(".game-card").count(), 0);
  await page
    .getByRole("button", { name: "Показать все игры", exact: true })
    .click();
  // Each of sixteen real modes: five rounds, one stored score and no XP from client answers.
  for (let mode = 0; mode < 16; mode++) {
    const launcher = page.locator(".game-card").nth(mode);
    await launcher.click();
    await page.locator("dialog[open]").waitFor();
    if (mode === 0) {
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press("Tab");
        assert(
          await page.evaluate(
            () => !!document.activeElement?.closest("dialog"),
          ),
        );
      }
      await page.keyboard.press("Shift+Tab");
    }
    if (mode === 0) {
      await page.setViewportSize({ width: 390, height: 900 });
      await page.screenshot({ path: shots + "/practice-dialog-mobile.png" });
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await finish(page);
    assert.match(
      await page.locator(".game-result").innerText(),
      /Результат сохранён/,
    );
    await page.keyboard.press("Escape");
    assert(
      await launcher.evaluate((el) => document.activeElement === el),
      "Dialog restores focus to its launcher",
    );
  }
  assert.equal(gamePosts, 16);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from mg_game_scores where user_id=$1",
        [me.id],
      )
    ).rows[0].n,
    16,
  );
  assert.equal(
    (await (await context.request.get(base + "/api/data")).json()).user.xp,
    xp,
  );
  // Save failure stays actionable; retry writes exactly once.
  let fail = true;
  await context.route("**/api/action", (r) => {
    if (r.request().postDataJSON()?.action === "game" && fail) {
      fail = false;
      return r.fulfill({
        status: 503,
        json: { error: "Isolated save failure" },
      });
    }
    return r.continue();
  });
  await page.locator(".game-card").first().click();
  await finish(page);
  assert.match(await page.locator(".game-result").innerText(), /не сохранён/);
  await page
    .getByRole("button", { name: "Повторить сохранение", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Результат сохранён." })
    .waitFor();
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from mg_game_scores where user_id=$1",
        [me.id],
      )
    ).rows[0].n,
    17,
  );
  await page.keyboard.press("Escape");
  await context.unroute("**/api/action");
  await load(page, "/achievements", ".achievement-card");
  await page
    .getByRole("button", { name: "Рассмотреть достижение", exact: false })
    .click();
  await page.waitForFunction(() =>
    document.activeElement?.matches("article.achievement-card.expanded"),
  );
  await page
    .getByRole("button", { name: "Сбросить фильтры", exact: true })
    .click();
  const count = await page.locator(".achievement-card").count();
  assert.equal(count, 33);
  const reveal = page.getByRole("button", {
    name: "Открыть награду: Первый кадр · Бронза",
    exact: true,
  });
  await reveal.click();
  assert.equal(
    await page.evaluate(
      (id) => localStorage.getItem(`mg_achievement_reveal:${id}:watch:1`),
      me.id,
    ),
    "1",
  );
  await page
    .getByRole("textbox", { name: "Найти достижение" })
    .fill("Первый кадр");
  assert.equal(await page.locator(".achievement-card").count(), 1);
  await page
    .getByRole("button", {
      name: "Уровни достижения: Первый кадр",
      exact: true,
    })
    .click();
  assert.equal(await page.locator(".ach-tier-row").count(), 4);
  assert.match(
    await page.locator(".ach-tiers-detail").innerText(),
    /Бронза[\s\S]*Серебро[\s\S]*Золото[\s\S]*Платина/,
  );
  await page
    .getByRole("combobox", { name: "Состояние достижения" })
    .selectOption("locked");
  assert.equal(await page.locator(".achievement-card").count(), 0);
  await page
    .getByRole("button", { name: "Сбросить фильтры", exact: true })
    .click();
  assert.equal(await page.locator(".achievement-card").count(), count);
  await page
    .getByRole("textbox", { name: "Найти достижение" })
    .fill("археолог");
  await page.getByRole("button", { name: /Уровни достижения:/ }).click();
  await page
    .locator(".ach-detail")
    .getByRole("button", { name: "Открыть каталог", exact: false })
    .click();
  await page.waitForURL(/category=.*year=before1960/);
  await load(page, "/achievements", ".achievement-card");
  assert.equal(
    await page
      .getByRole("button", {
        name: "Первый кадр · Бронза: оформление открыто",
        exact: true,
      })
      .count(),
    1,
  );
  await load(page, "/challenges", ".challenge-month-tab");
  const snapshot = await (await context.request.get(base + "/api/data")).json();
  assert(snapshot.challenges.some((c) => c.completed));
  assert(snapshot.challenges.some((c) => !c.completed && c.current));
  for (let m = 1; m <= 12; m++) {
    assert(snapshot.challenges.some((c) => c.month === m));
    await page
      .locator(".challenge-month-tab")
      .nth(m - 1)
      .click();
    assert.equal(
      await page.locator(".challenge-month-tab[aria-pressed=true]").count(),
      1,
    );
    assert.equal(
      await page.locator(".challenge-card").count(),
      snapshot.challenges.filter((c) => c.month === m).length,
    );
  }
  const month = new Date().getUTCMonth() + 1;
  await page
    .locator(".challenge-month-tab")
    .nth(month - 1)
    .click();
  await page.getByRole("button", { name: "Выполнены", exact: true }).click();
  assert.equal(
    await page.locator(".challenge-card").count(),
    snapshot.challenges.filter((c) => c.month === month && c.completed).length,
  );
  await page
    .getByRole("button", { name: "Все испытания", exact: true })
    .click();
  if (await page.locator(".challenge-catalog-link").count()) {
    await page.locator(".challenge-catalog-link").first().click();
    await page.waitForURL(/\/catalog\?genre=.*category=/);
  }
  for (const [path, selector] of [
    ["/games", ".cinema-games"],
    ["/achievements", ".cinema-achievements"],
    ["/challenges", ".cinema-challenges"],
  ]) {
    await load(page, path, selector);
    for (const theme of [
      "Тёмная",
      "Светлая",
      "Розовая",
      "Фиолетовая",
      "Жёлтая",
    ]) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await chooseTheme(page, theme);
      for (const width of [320, 360, 390, 600, 760, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => {
          document.activeElement?.blur();
          window.scrollTo(0, 0);
        });
        const geometry = await page.locator(selector).evaluate((el) => ({
          root: document.documentElement.scrollWidth,
          viewport: innerWidth,
          bad: [
            ...el.querySelectorAll(
              "button,input,select,article,aside,h1,h2,h3",
            ),
          ]
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return (
                r.width &&
                e.getClientRects().length &&
                (r.left < -1 || r.right > innerWidth + 1)
              );
            })
            .map((e) => e.className || e.tagName),
        }));
        assert(
          geometry.root <= width + 1,
          `${path} ${theme}/${width}: page overflow ${JSON.stringify(geometry)}`,
        );
        assert.deepEqual(
          geometry.bad,
          [],
          `${path} ${theme}/${width}: clipped controls`,
        );
        if (path === "/challenges") {
          assert.equal(
            await page.locator(".challenge-month-tab:visible").count(),
            12,
          );
          assert.equal(
            await page.locator(".challenge-month-tabs").evaluate(
              (el) =>
                [...el.children].filter((child) => {
                  const c = child.getBoundingClientRect(),
                    p = el.getBoundingClientRect();
                  return c.left < p.left - 1 || c.right > p.right + 1;
                }).length,
            ),
            0,
          );
        }
        if (
          ["Тёмная", "Светлая"].includes(theme) &&
          [390, 1440].includes(width)
        ) {
          await page.screenshot({
            path: `${shots}/${path.slice(1)}-${theme === "Тёмная" ? "dark" : "light"}-${width}.png`,
          });
          const panel =
            path === "/games"
              ? ".practice-library"
              : path === "/achievements"
                ? ".achievement-library"
                : ".challenge-calendar";
          await page
            .locator(panel)
            .evaluate((el) =>
              el.scrollIntoView({ behavior: "instant", block: "start" }),
            );
          await page.screenshot({
            path: `${shots}/${path.slice(1)}-workspace-${theme === "Тёмная" ? "dark" : "light"}-${width}.png`,
          });
        }
      }
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS cinema play: all16 modes ×5 real questions ×4 answers; guest gates/shortage; real practice writes, retry and no XP; achievement filters/4tiers/reveal/catalog; all12 challenge months/status/catalog; 5themes ×8widths ×3pages without horizontal clipping.",
  );
} finally {
  await browser.close();
  if (users.length) {
    for (const table of [
      "mg_game_scores",
      "mg_hidden_achievement_awards",
      "mg_hidden_achievement_events",
      "mg_challenge_progress",
      "mg_ratings",
      "mg_watches",
    ])
      await db.query(`delete from ${table} where user_id=any($1::int[])`, [
        users,
      ]);
    await db.query(
      "delete from mg_notifications where user_id=any($1::int[]) or actor_id=any($1::int[])",
      [users],
    );
  }
  if (challengeIds.length) {
    await db.query(
      "delete from mg_challenge_progress where challenge_id=any($1::int[])",
      [challengeIds],
    );
    await db.query("delete from mg_challenges where id=any($1::int[])", [
      challengeIds,
    ]);
  }
  if (films.length)
    await db.query("delete from mg_movies where id=any($1::int[])", [films]);
  if (users.length)
    await db.query("delete from mg_users where id=any($1::int[])", [users]);
  await db.end();
}
