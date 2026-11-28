// Read-only shell regression against a local production build; no database writes.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
const deps = createRequire(
  process.env.UI_TEST_DEPS
    ? resolve(process.env.UI_TEST_DEPS, "package.json")
    : import.meta.url,
);
const { chromium: pw } = deps("playwright-core");
const chromium = deps("@sparticuz/chromium").default;
const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:3000";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const browser = await pw.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter(
    (a) => !["--single-process", "--disable-web-security"].includes(a),
  ),
  headless: true,
});
const shots = process.env.SHELL_SCREENSHOTS || "/tmp/mm-shell-screenshots";
await mkdir(shots, { recursive: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base, { waitUntil: "networkidle" });
  const shell = page.locator(".shell-navigation");
  const rail = page.locator(".sidebar");
  const expand = () =>
    rail.getByRole("button", { name: "Развернуть меню", exact: true });
  const collapse = () =>
    rail.getByRole("button", { name: "Свернуть меню", exact: true });
  const auto = () =>
    rail.getByRole("button", {
      name: "Автоматическая ширина меню",
      exact: true,
    });
  const compact = async (value) => {
    await page.waitForFunction(
      (v) =>
        document
          .querySelector(".shell-navigation")
          ?.getAttribute("data-sidebar-compact") === String(v),
      value,
    );
    assert.equal((await rail.boundingBox()).width, value ? 76 : 244);
  };
  await compact(false);
  await collapse().click();
  await compact(true);
  assert.equal(await collapse().count(), 0);
  assert.equal(await expand().getAttribute("aria-expanded"), "false");
  await page.reload({ waitUntil: "networkidle" });
  await compact(true);
  assert.equal(await shell.getAttribute("data-sidebar"), "collapsed");
  await expand().click();
  await compact(false);
  await page.setViewportSize({ width: 1024, height: 900 });
  await compact(false);
  assert(await rail.getByText("ИССЛЕДОВАТЬ", { exact: true }).isVisible());
  assert(await rail.locator(".nav-label").first().isVisible());
  assert(await rail.locator(".sidebar-discover").isVisible());
  await auto().click();
  await compact(true);
  assert.equal(await auto().getAttribute("aria-pressed"), "true");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await compact(false);
  // Cross-tab preference events update the current tab immediately.
  await page.evaluate(() => {
    localStorage.setItem("mg_sidebar_layout_v1", "collapsed");
    dispatchEvent(new StorageEvent("storage", { key: "mg_sidebar_layout_v1" }));
  });
  await compact(true);
  await auto().click();
  await compact(false);
  // Keyboard skip link moves focus into the actual main landmark.
  await page.goto(base, { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .locator(".skip-navigation")
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await page.keyboard.press("Enter");
  assert.equal(
    await page
      .locator("#main-content")
      .evaluate((e) => e === document.activeElement),
    true,
  );
  // Guest personal links still request sign-in instead of exposing private content.
  await rail.getByRole("button", { name: "Мой профиль", exact: true }).click();
  const auth = page.locator(".auth-modal");
  await auth.waitFor();
  await auth.locator(".modal-close").click();
  // Dedicated cinema entry and active page indicator.
  await rail
    .getByRole("button", { name: "Афиша и сеансы", exact: true })
    .click();
  await page.waitForURL("**/showtimes");
  assert.equal(
    await rail
      .getByRole("button", { name: "Афиша и сеансы", exact: true })
      .getAttribute("aria-current"),
    "page",
  );
  // Footer links are actual local URLs; no fabricated informational pages.
  const footer = page.locator(".shell-footer");
  const hrefs = await footer
    .locator("a")
    .evaluateAll((es) => es.map((e) => e.getAttribute("href")));
  assert.deepEqual(hrefs, [
    "/catalog",
    "/top",
    "/showtimes",
    "/world",
    "/collab",
    "/games",
    "/leaderboard",
  ]);
  await footer.getByRole("link", { name: "Каталог", exact: true }).click();
  await page.waitForURL("**/catalog");
  await footer.scrollIntoViewIfNeeded();
  await footer.getByRole("button", { name: "Наверх", exact: true }).click();
  await page.waitForFunction(() => scrollY < 5);
  assert.equal(
    await page
      .locator("#main-content")
      .evaluate((e) => e === document.activeElement),
    true,
  );
  // Search remains a real visible entry, with keyboard shortcut and submit navigation.
  await page.keyboard.press("Control+k");
  const field = page.locator(".top-search input");
  assert(await field.evaluate((e) => e === document.activeElement));
  await field.fill("Кино для вечера");
  await field.press("Enter");
  await page.waitForURL(
    (url) =>
      url.pathname === "/catalog" &&
      url.searchParams.get("search") === "Кино для вечера",
  );
  // Header shortcut opens the established roulette, not another picker.
  await page
    .locator(".topbar")
    .getByRole("button", { name: "Открыть кинорулетку", exact: true })
    .click();
  await page.locator("dialog.cinema-roulette[open]").waitFor();
  await page.keyboard.press("Escape");
  for (const theme of ["dark", "light"]) {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
      document.documentElement.dataset.season = "off";
    }, theme);
    for (const width of [
      1440, 1280, 1050, 1024, 800, 761, 760, 600, 390, 360, 320,
    ]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(180);
      assert.equal(
        await rail.isVisible(),
        width > 760,
        `${theme}/${width} sidebar visibility`,
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${theme}/${width} horizontal overflow`,
      );
      const search = await page.locator(".top-search").boundingBox();
      const actions = await page.locator(".top-actions").boundingBox();
      assert(
        search.width >= 110,
        `${theme}/${width} usable search width ${search.width}`,
      );
      assert(
        actions.x >= 0 && actions.x + actions.width <= width + 1,
        `${theme}/${width} header actions fit`,
      );
      if (width <= 760)
        assert(
          search.y >= actions.y + actions.height - 1,
          `${theme}/${width} mobile search second row`,
        );
      await page.screenshot({ path: `${shots}/${theme}-${width}.png` });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await footer.scrollIntoViewIfNeeded();
  await footer.screenshot({ path: `${shots}/footer-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await footer.scrollIntoViewIfNeeded();
  await footer.screenshot({ path: `${shots}/footer-mobile.png` });
  await context.close();
  // Storage denied: the setting still works for this visit and informs the user.
  const restricted = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await restricted.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  const blocked = await restricted.newPage();
  blocked.on("pageerror", (e) => errors.push(e.message));
  await blocked.goto(base, { waitUntil: "networkidle" });
  await blocked.locator(".sidebar-toggle").click();
  await blocked.waitForFunction(
    () =>
      document
        .querySelector(".shell-navigation")
        ?.getAttribute("data-sidebar-compact") === "true",
  );
  assert(
    await blocked
      .getByText(
        "Вид меню изменён на этот визит: браузер не разрешил запоминание.",
        { exact: true },
      )
      .isVisible(),
  );
  await restricted.close();
  // Long signed-in names and XP must not squeeze search/actions off screen.
  const snapshot = await (await fetch(base + "/api/data")).json();
  const member = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const memberPage = await member.newPage();
  memberPage.on("pageerror", (e) => errors.push(e.message));
  await member.route("**/api/data", (r) =>
    r.fulfill({
      json: {
        ...snapshot,
        user: {
          id: 90001,
          username: "Очень длинное имя любителя кино",
          role: "visitor",
          xp: 16500,
          createdAt: "2026-01-01T00:00:00Z",
        },
        bookmarks: Array.from({ length: 103 }, (_, i) => i + 1),
        favoriteIds: [1, 2],
        unreadMessages: 3,
      },
    }),
  );
  await memberPage.goto(base, { waitUntil: "networkidle" });
  const memberRail = memberPage.locator(".sidebar");
  assert.equal(
    await memberRail
      .getByRole("button", { name: "Буду смотреть", exact: true })
      .locator(".nav-count")
      .innerText(),
    "99+",
  );
  assert.equal(
    await memberRail
      .getByRole("button", { name: "Любимое", exact: true })
      .locator(".nav-count")
      .innerText(),
    "2",
  );
  assert.equal(
    await memberRail
      .getByRole("button", { name: "Чат", exact: true })
      .locator(".nav-count")
      .innerText(),
    "3",
  );
  assert.equal(await memberRail.locator('[title="Админ-панель"]').count(), 0);
  for (const width of [1440, 1280, 1050, 1024, 800, 761, 760, 390, 320]) {
    await memberPage.setViewportSize({ width, height: 900 });
    await memberPage.waitForTimeout(200);
    assert(
      await memberPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `member ${width} overflow`,
    );
    const search = await memberPage.locator(".top-search").boundingBox();
    assert(
      search.width >= 110,
      `member ${width} search too narrow: ${search.width}`,
    );
    if (width === 1440) {
      await memberPage.waitForTimeout(800);
      await memberPage.screenshot({ path: `${shots}/member-home.png` });
    }
  }
  await memberPage.setViewportSize({ width: 1024, height: 900 });
  await memberRail
    .getByRole("button", { name: "Развернуть меню", exact: true })
    .click();
  for (const width of [1024, 800, 761]) {
    await memberPage.setViewportSize({ width, height: 900 });
    await memberPage.waitForTimeout(200);
    const search = await memberPage.locator(".top-search").boundingBox();
    assert(
      search.width >= 150,
      `expanded member ${width} search width ${search.width}`,
    );
    assert(await memberRail.locator(".nav-label").first().isVisible());
    assert(await memberRail.locator(".nav-count").first().isVisible());
    if (width === 800)
      await memberPage.screenshot({
        path: `${shots}/member-expanded-800.png`,
        fullPage: false,
      });
    const overflow = await memberPage.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll(".main-wrap *")]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return (
            r.right > innerWidth + 1 &&
            r.width > 0 &&
            getComputedStyle(e).position !== "fixed"
          );
        })
        .slice(0, 12)
        .map((e) => ({
          c: e.className,
          width: e.getBoundingClientRect().width,
          right: e.getBoundingClientRect().right,
        })),
    }));
    assert(overflow.scroll <= width + 1, JSON.stringify(overflow));
  }
  await member.close();
  assert.deepEqual(errors, []);
  console.log(
    "Shell navigation: persistence, auto/explicit sizes, cross-tab sync, restricted storage, keyboard, guest gating, showtimes, footer, roulette, 11 widths × 2 themes PASS",
  );
} finally {
  await browser.close();
}
