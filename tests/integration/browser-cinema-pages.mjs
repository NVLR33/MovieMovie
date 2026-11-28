// Read-only UI fixtures on the actual local production server. No action writes.
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
assert(snapshot.films.length >= 2);
const films = snapshot.films.slice(0, 2).map((film, i) => ({
  ...film,
  title: i
    ? "Другая сторона экрана"
    : "Однажды за пределами привычного мира: невероятная история о выборе, памяти и возвращении домой",
  genre: "Драма, Фантастика",
  description:
    "История о том, как маленькое решение меняет целую вселенную. ".repeat(20),
  studio: "Студия одного невероятно длинного названия",
  rating: 8.5,
  ratingCount: 2,
}));
const browser = await pw.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter(
    (a) => !["--single-process", "--disable-web-security"].includes(a),
  ),
  headless: true,
});
const shots = "/tmp/mm-pages-verified";
await mkdir(shots, { recursive: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(() => {
    localStorage.setItem("mg_season_mode", "off");
    localStorage.setItem("mg_ambient_canvas", "false");
  });
  await context.route("**/api/data", (r) =>
    r.fulfill({
      json: {
        ...snapshot,
        films,
        user: null,
        bookmarks: [],
        favoriteIds: [],
        ratings: [],
        watches: [],
      },
    }),
  );
  await context.route("**/api/pulse*", (r) =>
    r.fulfill({
      json: {
        films,
        weeklyLeaders: snapshot.weeklyLeaders,
        weeklyPulse: snapshot.weeklyPulse,
      },
    }),
  );
  const page = await context.newPage(),
    errors = [],
    writes = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/action" && r.method() === "POST")
      writes.push(r.postData());
  });
  const load = async (path) => {
    await page.goto(base + path);
    await page.waitForFunction(
      () =>
        document.querySelector(".app-shell")?.getAttribute("data-hud-busy") ===
        "false",
    );
  };
  await load("/catalog");
  const screening = page.locator(".catalog-screening");
  await screening.waitFor();
  const first = await screening.locator("h2").innerText();
  await screening
    .getByRole("button", { name: "Следующая история в выборке", exact: true })
    .click();
  assert.notEqual(await screening.locator("h2").innerText(), first);
  const before = page.url();
  const entry = screening.getByRole("link", {
    name: "Быстрый взгляд",
    exact: true,
  });
  assert.match(await entry.getAttribute("href"), /^\/movie\/\d+$/);
  await entry.focus();
  const position = await page.evaluate(() => scrollY);
  await page.keyboard.press("Enter");
  await page.locator("dialog.movie-quick-view").waitFor();
  await page.keyboard.press("Escape");
  await page.locator("dialog.movie-quick-view").waitFor({ state: "detached" });
  await page.waitForFunction((y) => Math.abs(scrollY - y) < 3, position);
  assert.equal(page.url(), before);
  assert(await entry.evaluate((e) => e === document.activeElement));
  await page
    .getByRole("textbox", { name: "Поиск в каталоге", exact: true })
    .fill("не существует 000");
  await page.locator(".catalog-canvas .empty-state").waitFor();
  assert.equal(await screening.count(), 0);
  await page
    .getByRole("button", { name: "Показать весь каталог", exact: true })
    .click();
  await screening.waitFor();
  for (const theme of ["dark", "light", "pink", "purple", "yellow"]) {
    for (const path of ["/catalog", `/movie/${films[0].id}`]) {
      await load(path);
      await page.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      for (const width of [320, 390, 600, 760, 900, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.waitForTimeout(120);
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${path} ${theme}/${width} page fits`,
        );
        if (path === "/catalog") {
          const rail = await page.locator(".catalog-console").boundingBox(),
            canvas = await page.locator(".catalog-canvas").boundingBox();
          if (width > 900)
            assert(
              rail.x + rail.width < canvas.x && Math.abs(rail.y - canvas.y) < 2,
              `${theme}/${width} selection/results split`,
            );
          else
            assert(
              canvas.y >= rail.y + rail.height,
              `${theme}/${width} console stacks before results`,
            );
          await page.locator(".catalog-jump-results").click();
          await page.waitForFunction(
            () => location.hash === "#catalog-results",
          );
          assert(
            await page
              .locator("#catalog-results")
              .evaluate((e) => e === document.activeElement),
          );
          await page.evaluate(() => scrollTo(0, 0));
        } else {
          const ticket = await page.locator(".detail-ticket").boundingBox(),
            poster = await page.locator(".detail-poster").boundingBox(),
            title = await page.locator(".detail-intro h1").boundingBox();
          if (width > 1180)
            assert(
              ticket.x > title.x &&
                Math.abs(
                  ticket.x +
                    ticket.width -
                    (await page.locator(".detail-hero").boundingBox()).x -
                    (await page.locator(".detail-hero").boundingBox()).width,
                ) < 50,
              `${theme}/${width} independent ticket`,
            );
          else
            assert(
              ticket.y >= poster.y + poster.height,
              `${theme}/${width} ticket below opening`,
            );
          if (width <= 600)
            assert(
              Math.abs(title.x - poster.x) < 2 &&
                title.width > poster.width * 2,
              `${theme}/${width} long title gets a full-width row`,
            );
          for (const id of ["story-file", "story-verdict"]) {
            await page.locator(`.detail-chapters a[href="#${id}"]`).click();
            assert(
              await page
                .locator("#" + id)
                .evaluate((e) => e === document.activeElement),
              `${id} focus`,
            );
          }
          await page.evaluate(() => scrollTo(0, 0));
        }
        if (["dark", "light"].includes(theme) && [390, 1440].includes(width))
          await page.screenshot({
            path: `${shots}/${path === "/catalog" ? "catalog" : "detail"}-${theme}-${width}.png`,
            fullPage: false,
          });
      }
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log(
    "PASS cinema pages: split discovery workspace, responsive story ticket/dossier, filtered manual spotlight, empty/reset, quick-view route/scroll/focus, real section anchors, long titles and 5 themes × 8 widths × 2 pages; no action writes.",
  );
  await context.close();
} finally {
  await browser.close();
}
