// The permanent sidebar has been replaced by spaces + a complete native navigation dialog.
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
const browser = await pw.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter(
    (a) => !["--single-process", "--disable-web-security"].includes(a),
  ),
  headless: true,
});
const shots = process.env.SHELL_SCREENSHOTS || "/tmp/mm-experience-shell";
await mkdir(shots, { recursive: true });
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.addInitScript(() => {
    localStorage.setItem("mg_season_mode", "off");
    localStorage.setItem("mg_sidebar_layout_v1", "collapsed");
  });
  await page.goto(base, { waitUntil: "networkidle" });
  assert.equal(await page.locator(".sidebar").count(), 0);
  const menu = page.locator(".cinema-explore"),
    dialog = page.locator("dialog.cinema-navigation-dialog");
  await menu.click();
  await dialog.waitFor();
  assert.equal(
    await dialog.locator("a").count(),
    17,
    "Every public/personal destination remains available for a guest",
  );
  for (const path of [
    "/",
    "/catalog",
    "/showtimes",
    "/top",
    "/world",
    "/watchlist",
    "/favorites",
    "/profile",
    "/wrapped",
    "/collab",
    "/friends",
    "/chat",
    "/games",
    "/achievements",
    "/challenges",
    "/leaderboard",
    "/watchroom",
  ])
    assert(await dialog.locator(`a[href="${path}"]`).count(), path);
  assert.equal(await dialog.locator('a[href="/admin"]').count(), 0);
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press("Tab");
    assert(
      await dialog.evaluate((e) => e.contains(document.activeElement)),
      "Navigation focus stays inside dialog",
    );
  }
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  assert(await menu.evaluate((e) => e === document.activeElement));
  await menu.click();
  await dialog.locator('a[href="/profile"]').click();
  await page.locator(".auth-modal").waitFor();
  assert.equal(new URL(page.url()).pathname, "/");
  await page.locator(".auth-modal .modal-close").click();
  await menu.click();
  await dialog.locator('a[href="/showtimes"]').click();
  await page.waitForURL("**/showtimes");
  assert.equal(
    await page
      .locator('.cinema-subnav a[href="/showtimes"]')
      .getAttribute("aria-current"),
    "page",
  );
  await page.locator('.cinema-spaces a[href="/collab"]').click();
  await page.waitForURL("**/collab");
  assert.equal(
    await page
      .locator('.cinema-spaces a[href="/collab"]')
      .getAttribute("aria-current"),
    "location",
  );
  await page.goto(base, { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  assert(
    await page
      .locator(".skip-navigation")
      .evaluate((e) => e === document.activeElement),
  );
  await page.keyboard.press("Enter");
  assert(
    await page
      .locator("#main-content")
      .evaluate((e) => e === document.activeElement),
  );
  await page.keyboard.press("Control+k");
  const field = page.locator(".top-search input");
  assert(await field.evaluate((e) => e === document.activeElement));
  await field.fill("Кино на вечер");
  await field.press("Enter");
  await page.waitForURL(
    (url) =>
      url.pathname === "/catalog" &&
      url.searchParams.get("search") === "Кино на вечер",
  );
  const footer = page.locator(".shell-footer");
  assert.deepEqual(
    await footer
      .locator("a")
      .evaluateAll((es) => es.map((e) => e.getAttribute("href"))),
    [
      "/catalog",
      "/top",
      "/showtimes",
      "/world",
      "/collab",
      "/games",
      "/leaderboard",
    ],
  );
  await footer.getByRole("link", { name: "Каталог", exact: true }).click();
  await page.waitForURL("**/catalog");
  await footer.scrollIntoViewIfNeeded();
  await footer.getByRole("button", { name: "Наверх", exact: true }).click();
  await page.waitForFunction(() => scrollY < 5);
  assert(
    await page
      .locator("#main-content")
      .evaluate((e) => e === document.activeElement),
  );
  await page.locator(".header-discover-button").click();
  await page.locator("dialog.cinema-roulette[open]").waitFor();
  await page.keyboard.press("Escape");
  for (const theme of ["dark", "light"]) {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    for (const width of [
      1920, 1440, 1280, 1180, 1050, 1024, 900, 800, 761, 760, 600, 390, 360,
      320,
    ]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(200);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${theme}/${width} page overflow`,
      );
      const search = await page.locator(".top-search").boundingBox(),
        actions = await page.locator(".top-actions").boundingBox(),
        nav = await page.locator(".cinema-nav").boundingBox();
      assert(
        search.width >= 130,
        `${theme}/${width} usable search ${search.width}`,
      );
      assert(
        actions.x + actions.width <= width + 1,
        `${theme}/${width} account actions`,
      );
      assert(
        nav.x + nav.width <= actions.x + 1,
        `${theme}/${width} navigation/actions overlap`,
      );
      await menu.click();
      await dialog.waitFor();
      const box = await dialog.boundingBox();
      assert(
        box.x >= 0 &&
          box.x + box.width <= width + 1 &&
          box.y >= 0 &&
          box.y + box.height <= 900,
        `${theme}/${width} navigation dialog fits`,
      );
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
      if ([1440, 1024, 390].includes(width))
        await page.screenshot({ path: `${shots}/${theme}-${width}.png` });
    }
  }
  await context.close();
  const blocked = await browser.newContext({
    viewport: { width: 1024, height: 900 },
  });
  await blocked.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  const restricted = await blocked.newPage();
  restricted.on("pageerror", (e) => errors.push(e.message));
  await restricted.goto(base, { waitUntil: "networkidle" });
  await restricted.locator(".cinema-explore").click();
  await restricted.locator("dialog.cinema-navigation-dialog[open]").waitFor();
  await blocked.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS spaces shell: full-width layout, all destinations/guest gating, navigation modal focus/Escape/restore, search, footer, roulette, 14 widths × 2 themes, restricted storage and retired sidebar preferences.",
  );
} finally {
  await browser.close();
}
