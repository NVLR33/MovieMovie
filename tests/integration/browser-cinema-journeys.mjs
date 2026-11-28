// Actual production app + marker-guarded local SQL. Schedule responses are deterministic fixtures,
// not verification of the live external provider. No GPS or booking requests are made.
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
const films = [],
  users = [],
  shots = "/tmp/mm-journeys-screenshots";
await mkdir(shots, { recursive: true });
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    }),
    guest = await browser.newContext({
      viewport: { width: 390, height: 1000 },
      reducedMotion: "reduce",
    });
  for (const ctx of [context, guest])
    await ctx.addInitScript(() => {
      localStorage.setItem("mg_season_mode", "off");
      localStorage.setItem("mg_ambient_canvas", "false");
      window.__gpsCalls = 0;
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition() {
            window.__gpsCalls++;
          },
        },
      });
    });
  const stamp = Date.now(),
    response = await context.request.post(base + "/api/auth", {
      data: {
        action: "register",
        email: `journey-${stamp}@example.test`,
        username: "Atlas" + stamp,
        password: "isolated-journey-password",
      },
    });
  assert.equal(response.status(), 200);
  const me = (await response.json()).user;
  users.push(me.id);
  for (let i = 0; i < 18; i++)
    films.push(
      (
        await db.query(
          "insert into mg_movies(title,description,category,genre,year,duration,poster,country)values($1,'A geography fixture without invented watches.',$2,'Драма',$3,100,'/brand/moviemovie-logo.png',$4)returning id",
          [
            "Атлас " + i + " " + stamp,
            i % 2 ? "Сериал" : "Фильм",
            1980 + i,
            i < 14
              ? "Япония"
              : i === 14
                ? "Япония, США"
                : i === 15
                  ? "Франция"
                  : i === 16
                    ? "СССР"
                    : null,
          ],
        )
      ).rows[0].id,
    );
  await db.query(
    "insert into mg_watches(user_id,movie_id)values($1,$2),($1,$3)",
    [me.id, films[0], films[14]],
  );
  const page = await context.newPage(),
    anon = await guest.newPage(),
    errors = [];
  let posts = 0;
  for (const p of [page, anon])
    p.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (
      r.method() === "POST" &&
      /\/api\/(action|pet)$/.test(new URL(r.url()).pathname) &&
      r.postDataJSON()?.action !== "profile"
    )
      posts++;
  });
  async function load(p, path, selector) {
    assert.equal((await p.goto(base + path)).status(), 200);
    await p.locator('.app-shell[data-hud-busy="false"]').waitFor();
    await p.locator(selector).first().waitFor();
    // React may briefly retain the guest atlas offscreen while the authenticated lazy subtree commits.
    if (path.startsWith("/world"))
      await p.waitForFunction(
        () => document.querySelectorAll(".world-cinema").length === 1,
      );
  }
  await load(anon, "/world", ".world-map-svg");
  await anon.getByRole("button", { name: "Мои открытия", exact: true }).click();
  await anon.locator(".auth-modal").waitFor();
  await anon.locator(".auth-modal .modal-close").click();
  await load(page, "/world?country=JP", ".world-film");
  const country = page.getByRole("combobox", {
    name: "Выбранная страна",
    exact: true,
  });
  assert.equal(await country.inputValue(), "JP");
  assert.equal(await page.locator(".world-film").count(), 12);
  await page.getByRole("button", { name: "Показать ещё", exact: true }).click();
  assert.equal(await page.locator(".world-film").count(), 15);
  await page
    .getByRole("searchbox", { name: "Найти страну", exact: true })
    .fill("  Япо  ");
  assert.equal(await country.locator('option[value="JP"]').count(), 1);
  await page
    .getByRole("combobox", {
      name: "Сортировка материалов региона",
      exact: true,
    })
    .selectOption("year");
  await page.locator(".world-film").first().click();
  await page.locator(".movie-quick-view").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await country.inputValue(), "JP");
  assert.equal(await page.locator(".world-film").count(), 15);
  assert.equal(
    await page
      .getByRole("searchbox", { name: "Найти страну", exact: true })
      .inputValue(),
    "  Япо  ",
  );
  await page
    .getByRole("button", { name: "Приблизить страну", exact: true })
    .click();
  assert.notEqual(
    await page.locator(".world-map-svg").getAttribute("viewBox"),
    "0 0 960 480",
  );
  await page.getByRole("button", { name: "Весь мир", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Найти страну", exact: true })
    .fill("");
  await page.getByRole("button", { name: "Мои открытия", exact: true }).click();
  assert.equal(await page.locator(".world-film").count(), 2);
  await page
    .getByRole("button", { name: "Карта каталога", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Ещё не смотрел", exact: true })
    .check();
  assert.equal(await page.locator(".world-film").count(), 12);
  await page.getByRole("button", { name: "Показать ещё", exact: true }).click();
  assert.equal(await page.locator(".world-film").count(), 13);
  await page
    .getByRole("checkbox", { name: "Ещё не смотрел", exact: true })
    .uncheck();
  await page
    .getByRole("combobox", { name: "Категория на карте", exact: true })
    .selectOption("Фильм");
  assert.equal(await page.locator(".world-film").count(), 8);
  await page
    .getByRole("combobox", { name: "Категория на карте", exact: true })
    .selectOption("Все");
  const jp = page.locator('.world-country[data-country="JP"]');
  await jp.focus();
  await page.keyboard.press("ArrowRight");
  const next = await page.evaluate(() =>
    document.activeElement?.getAttribute("data-country"),
  );
  assert(next);
  await page.keyboard.press("Enter");
  assert.equal(await country.inputValue(), next);
  await country.selectOption("JP");
  await page
    .locator(".atlas-destinations button")
    .filter({ hasText: "США" })
    .click();
  assert.equal(await country.inputValue(), "US");
  await page
    .getByRole("button", { name: "Сбросить страну", exact: true })
    .click();
  assert.equal(await country.inputValue(), "");
  await load(page, "/world?country=unknown", ".world-film");
  assert.equal(await country.inputValue(), "unknown");
  assert((await page.locator(".world-film").count()) >= 2);
  assert.equal(
    await page.locator(`.world-film[href="/movie/${films[16]}"]`).count(),
    1,
  );
  assert.equal(
    await page.locator(`.world-film[href="/movie/${films[17]}"]`).count(),
    1,
  );
  assert.match(await page.locator(".world-film-grid").innerText(), /СССР/);
  await country.selectOption("AQ");
  await page.locator(".world-results .empty-state").waitFor();
  await page
    .getByRole("button", { name: "Открыть карту всего каталога", exact: true })
    .click();
  assert.equal(await country.inputValue(), "");
  // Geography did not write watches, ratings, rewards or other actions.
  assert.equal(posts, 0);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from mg_watches where user_id=$1",
        [me.id],
      )
    ).rows[0].n,
    2,
  );
  let mode = "ready";
  const scheduleRequests = [];
  await context.route("**/api/showtimes?*", (r) => {
    const url = new URL(r.request().url()),
      city = url.searchParams.get("city"),
      date = url.searchParams.get("date") || "2026-11-22";
    scheduleRequests.push({ city, date });
    if (mode === "error")
      return r.fulfill({
        status: 502,
        json: { error: "Изолированная ошибка источника" },
      });
    const showing = (id, movieId, movie, cinema, hour, address) => ({
      id,
      movieId,
      movie,
      cinema,
      address,
      startsAt: `${date}T${hour}:00:00Z`,
      price: "от 350 ₽",
      format: "2D",
      url: "https://kudago.com/ekb/movie/11/",
    });
    return r.fulfill({
      json: {
        city,
        date,
        today: "2026-11-22",
        timezone: "Asia/Yekaterinburg",
        source: "KudaGo",
        status: mode === "unsupported" ? "unsupported" : "ready",
        truncated: mode === "partial",
        updatedAt: date + "T09:00:00Z",
        showings: ["empty", "unsupported"].includes(mode)
          ? []
          : [
              showing(2, 11, "Большая история", "Космос", "14", "Мира, 10"),
              showing(1, 11, "Большая история", "Космос", "12", "Мира, 10"),
              showing(
                3,
                12,
                "Ещёоднаоченьдлиннаяисториябезпробеловдляпроверкипереносов",
                "Салют",
                "13",
                "Оченьдлинноеименованиенабережнойбезпробелов, 100",
              ),
            ],
      },
    });
  });
  await load(page, "/showtimes", ".screenings-stage");
  assert.equal(
    scheduleRequests.length,
    0,
    "No schedule request without a city",
  );
  await page
    .locator(".showtimes-city-panel")
    .getByLabel("Город", { exact: true })
    .fill("Екатеринбург");
  await page
    .locator(".showtimes-city-panel")
    .getByRole("button", { name: "Применить", exact: true })
    .click();
  await page.locator(".showtime-movie").first().waitFor();
  assert.equal(await page.locator(".showtime-movie").count(), 2);
  assert.equal(await page.locator(".showtime-slots a").count(), 3);
  assert.match(
    await page.locator(".showtime-slots a").first().innerText(),
    /17:00/,
  ); // 12:00 UTC, city UTC+5; sorted at the presentation boundary.
  for (const link of await page.locator(".showtime-slots a").all()) {
    assert.equal(await link.getAttribute("target"), "_blank");
    assert.match(await link.getAttribute("rel"), /noopener/);
    assert.match(await link.getAttribute("href"), /^https:\/\/kudago.com\//);
  }
  await page
    .getByRole("combobox", { name: "Кинотеатр", exact: true })
    .selectOption("Салют");
  assert.equal(await page.locator(".showtime-slots a").count(), 1);
  await page
    .getByRole("combobox", { name: "Кинотеатр", exact: true })
    .selectOption("");
  await page
    .getByRole("searchbox", { name: "Поиск по афише", exact: true })
    .fill("  БОЛЬШАЯ  ");
  assert.equal(await page.locator(".showtime-movie").count(), 1);
  await page
    .getByRole("searchbox", { name: "Поиск по афише", exact: true })
    .fill("НЕ_НАЙТИ");
  await page
    .getByRole("button", { name: "Сбросить фильтры", exact: true })
    .click();
  assert.equal(await page.locator(".showtime-slots a").count(), 3);
  await page
    .getByRole("combobox", { name: "Дата сеансов", exact: true })
    .selectOption("2026-11-28");
  await page.locator(".showtime-slots a").first().waitFor();
  assert.equal(scheduleRequests.at(-1).date, "2026-11-28");
  for (const state of ["empty", "unsupported", "error", "partial"]) {
    mode = state;
    await load(page, "/showtimes", ".screenings-stage");
    if (state === "partial") {
      await page.locator(".showtimes-partial").waitFor();
      assert.equal(await page.locator(".showtime-slots a").count(), 3);
    } else {
      await page.locator(".showtimes-empty").waitFor();
      assert.equal(await page.locator(".showtime-slots a").count(), 0);
    }
    assert.equal(
      await page
        .getByRole("link", { name: /Искать во внешнем сервисе/ })
        .count(),
      1,
    );
  }
  mode = "ready";
  for (const [path, selector, panel] of [
    ["/world", ".world-cinema", ".atlas-workspace"],
    ["/showtimes", ".showtimes-page", ".screenings-workspace"],
  ]) {
    await load(page, path, selector);
    if (path === "/showtimes")
      await page.locator(".showtime-movie").first().waitFor();
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
          window.scrollTo({ top: 0, behavior: "instant" });
        });
        const result = await page.locator(selector).evaluate((el) => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
          bad: [...el.querySelectorAll("button,a,input,select,h1,h2,h3,aside")]
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
          result.scroll <= width + 1,
          `${path} ${theme}/${width}: ${JSON.stringify(result)}`,
        );
        assert.deepEqual(
          result.bad,
          [],
          `${path} ${theme}/${width}: clipped controls`,
        );
        if (
          ["Тёмная", "Светлая"].includes(theme) &&
          [390, 1440].includes(width)
        ) {
          await page.screenshot({
            path: `${shots}/${path.slice(1)}-${theme === "Тёмная" ? "dark" : "light"}-${width}.png`,
          });
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
  assert.equal(await page.evaluate(() => window.__gpsCalls), 0);
  assert.equal(posts, 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS discovery journeys: actual atlas country/co-production/unknown/deep-link/watch/category/unseen/zoom/keyboard/pagination/quick-view state; schedule city/date/search/cinema/local-time/empty/unsupported/error/partial states with intercepted provider responses; 5 themes ×8 widths ×2 routes; no automatic GPS, watches or rewards.",
  );
} finally {
  await browser.close();
  if (users.length) {
    for (const table of [
      "mg_ratings",
      "mg_watches",
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
  }
  if (films.length)
    await db.query("delete from mg_movies where id=any($1::int[])", [films]);
  if (users.length)
    await db.query("delete from mg_users where id=any($1::int[])", [users]);
  await db.end();
}
