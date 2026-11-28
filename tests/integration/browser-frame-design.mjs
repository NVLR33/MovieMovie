// Frame design on the actual production app. Catalog/member fixtures are read-only interceptions.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
const deps = createRequire(
  process.env.UI_TEST_DEPS
    ? resolve(process.env.UI_TEST_DEPS, "package.json")
    : import.meta.url,
);
const { chromium: pw } = deps("playwright-core"),
  chromium = deps("@sparticuz/chromium").default;
const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:3000";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const snapshot = await (await fetch(base + "/api/data")).json();
const template = snapshot.films[0];
assert(
  snapshot.films.length >= 2,
  "Requires the two baseline titles from serve-audit-db.mjs",
);
const films = [
  {
    ...template,
    id: snapshot.films[0].id,
    title: "История одного невероятно длинного и удивительного вечера",
    genre: "Приключения, Комедия",
    mood: null,
    rating: 8.7,
    ratingCount: 10,
    featured: true,
  },
  {
    ...template,
    id: snapshot.films[1].id,
    title: "Космос внутри",
    genre: "Фантастика",
    mood: null,
    rating: 9.1,
    ratingCount: 20,
    featured: false,
  },
  {
    ...template,
    id: 1900000001,
    title: "По ту сторону тишины",
    genre: "Драма",
    mood: null,
    rating: 8.4,
    ratingCount: 10,
    featured: false,
  },
  {
    ...template,
    id: 1900000002,
    title: "Снова к звёздам",
    genre: "Фантастика",
    mood: null,
    rating: 7.8,
    ratingCount: 10,
    featured: false,
  },
];
const browser = await pw.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter(
    (a) => !["--single-process", "--disable-web-security"].includes(a),
  ),
  headless: true,
});
const shots = process.env.FRAME_SCREENSHOTS || "/tmp/mm-frame-screenshots";
await mkdir(shots, { recursive: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(() => {
    localStorage.setItem("mg_season_mode", "off");
  });
  let empty = false;
  await context.route("**/api/data", (r) =>
    r.fulfill({
      json: {
        ...snapshot,
        films: empty ? [] : films,
        user: null,
        notifications: [],
        bookmarks: [],
        favoriteIds: [],
      },
    }),
  );
  await context.route("**/api/pulse*", (r) =>
    r.fulfill({
      json: {
        films: empty ? [] : films,
        weeklyLeaders: snapshot.weeklyLeaders,
        weeklyPulse: snapshot.weeklyPulse,
      },
    }),
  );
  const page = await context.newPage(),
    errors = [],
    writes = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      /hydration|Minified React error/i.test(m.text())
    )
      errors.push(m.text());
  });
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/action" && r.method() === "POST")
      writes.push(r.postData());
  });
  const open = async (path = "/") => {
    await page.goto(base + path);
    await page.locator(".cinema-design").waitFor();
    await page.waitForFunction(
      () =>
        document.querySelector(".topbar") && document.readyState === "complete",
    );
    await page.waitForTimeout(250);
  };
  const theme = async (value) => {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, value);
  };
  const fit = async (label) => {
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `${label}: page overflow`,
    );
  };
  await open();
  const panel = page.locator(".evening-discovery");
  await panel.locator(".evening-film").waitFor();
  assert.match(
    await page
      .locator(".spotlight-story h1")
      .evaluate((e) => getComputedStyle(e).fontFamily),
    /Golos/,
  );
  assert.equal(
    await panel.locator(".evening-result").getAttribute("data-movie-id"),
    String(films[1].id),
  );
  await panel.getByRole("button", { name: "За гранью", exact: true }).click();
  assert.equal(
    await panel
      .getByRole("button", { name: "За гранью", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    await panel.locator(".evening-catalog").getAttribute("href"),
    "/catalog?mood=mind",
  );
  await panel.getByRole("button", { name: "Ещё вариант", exact: true }).click();
  assert.equal(
    await panel.locator(".evening-result").getAttribute("data-movie-id"),
    String(films[3].id),
  );
  await panel.getByRole("button", { name: "Ещё вариант", exact: true }).click();
  assert.equal(
    await panel.locator(".evening-result").getAttribute("data-movie-id"),
    String(films[1].id),
  );
  await panel
    .getByRole("button", { name: "На одном дыхании", exact: true })
    .click();
  await panel.locator(".evening-empty").waitFor();
  assert.equal(await panel.locator(".evening-film").count(), 0);
  assert(await panel.locator(".evening-empty").isVisible());
  await panel
    .getByRole("button", { name: "Показать всё", exact: true })
    .click();
  assert.equal(
    await panel.locator(".evening-result").getAttribute("data-movie-id"),
    String(films[1].id),
  );
  // Toggle the same mood off, cycle reset when selecting another mood, single-result disabled state.
  await panel
    .getByRole("button", { name: "Почувствовать", exact: true })
    .click();
  assert.equal(
    await panel.locator(".evening-result").getAttribute("data-movie-id"),
    String(films[2].id),
  );
  assert(
    await panel
      .getByRole("button", { name: "Ещё вариант", exact: true })
      .isDisabled(),
  );
  await panel
    .getByRole("button", { name: "Почувствовать", exact: true })
    .click();
  assert.equal(
    await panel.locator(".evening-catalog").getAttribute("href"),
    "/catalog",
  );
  await panel.getByRole("button", { name: "За гранью", exact: true }).focus();
  await page.keyboard.press("Space");
  assert.equal(
    await panel
      .getByRole("button", { name: "За гранью", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await panel.locator(".evening-catalog").click();
  await page.waitForURL("**/catalog?mood=mind");
  await page.locator(".film-grid .film-card").first().waitFor();
  await page.waitForFunction(
    () => document.querySelectorAll(".film-grid .film-card").length === 2,
  );
  assert.equal(await page.locator(".film-grid .film-card").count(), 2);
  await open();
  await panel.locator(".evening-film").click();
  await page.locator("dialog.movie-quick-view[open]").waitFor();
  await page
    .locator("dialog.movie-quick-view")
    .getByRole("link", { name: "Полная карточка", exact: true })
    .click();
  await page.waitForURL(`**/movie/${films[1].id}`);
  await page.locator(".movie-detail-page").waitFor();
  // All five themes share the new vocabulary; no horizontal overflow on key form factors.
  for (const t of ["dark", "light", "pink", "purple", "yellow"]) {
    await open();
    await theme(t);
    for (const width of [320, 390, 760, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1080 });
      await page.waitForTimeout(140);
      await fit(`home ${t}/${width}`);
      assert(await panel.isVisible());
      const ps = await panel.boundingBox(),
        hero = await page.locator(".spotlight-stage").boundingBox();
      assert(
        ps.x >= 0 && ps.x + ps.width <= width + 1,
        `console fits ${t}/${width}`,
      );
      assert(
        ps.y >= hero.y + hero.height - 1,
        `mood console follows cinematic stage ${t}/${width}`,
      );
      if ([390, 1440, 1920].includes(width))
        await page.screenshot({ path: `${shots}/home-${t}-${width}.png` });
    }
  }
  for (const path of [
    "/catalog",
    "/top",
    "/collab",
    "/games",
    "/achievements",
    "/leaderboard",
    "/profile",
    "/showtimes",
    "/world",
    `/movie/${films[0].id}`,
  ]) {
    for (const t of ["dark", "light"]) {
      await open(path);
      await theme(t);
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1080 });
        await page.waitForTimeout(140);
        await fit(`${path} ${t}/${width}`);
        await page.screenshot({
          path: `${shots}/${path.replaceAll("/", "-")}-${t}-${width}.png`,
        });
      }
    }
  }
  await open();
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert(
    await panel.evaluate(
      (e) =>
        parseFloat(
          getComputedStyle(e.querySelector(".evening-film-copy"))
            .animationDuration,
        ) <= 0.001,
    ),
  );
  // Forced colors preserve selected state. The UI remains usable with no backdrop filter support.
  await page.emulateMedia({ forcedColors: "active" });
  await panel.getByRole("button", { name: "За гранью", exact: true }).click();
  assert.equal(
    await panel
      .getByRole("button", { name: "За гранью", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.emulateMedia({ forcedColors: "none" });
  empty = true;
  await open();
  await panel.locator(".evening-empty").waitFor();
  assert.equal(await panel.locator(".evening-film").count(), 0);
  assert.equal(
    await panel.locator(".evening-catalog").getAttribute("href"),
    "/catalog",
  );
  assert.equal(
    writes.length,
    0,
    "Discovery must not create watch/rating/XP actions",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS Frame design: bento discovery, shared catalog mood rules, counts/cycling/empty states/keyboard/navigation, 5 themes × 6 widths, 10 routes × 2 themes × 2 widths, reduced motion/forced colors; no action writes.",
  );
  await context.close();
} finally {
  await browser.close();
}
