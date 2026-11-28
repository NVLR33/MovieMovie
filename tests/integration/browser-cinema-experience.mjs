// Native quick view + history + actual collection actions. Only the marker-guarded local DB.
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
const shots =
  process.env.EXPERIENCE_SCREENSHOTS || "/tmp/mm-experience-screenshots";
await mkdir(shots, { recursive: true });
const ids = [];
let userId;
try {
  const stamp = Date.now(),
    studio = "QuickViewFixture" + stamp;
  for (let i = 0; i < 4; i++)
    ids.push(
      (
        await db.query(
          "insert into mg_movies(title,description,category,genre,studio,year,duration,poster,backdrop,trailer_url,featured)values($1,$2,'Фильм','Драма, Фантастика',$3,2024,118,'/brand/moviemovie-logo.png','/brand/moviemovie-logo.png','https://media.example.com/preview.mp4',true)returning id",
          [
            "История за пределами кадра " + i,
            "История о выборе и втором шансе. ".repeat(30),
            studio,
          ],
        )
      ).rows[0].id,
    );
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    }),
    page = await context.newPage(),
    errors = [];
  await context.addInitScript(() =>
    localStorage.setItem("mg_season_mode", "off"),
  );
  await context.route("https://media.example.com/**", (r) =>
    r.fulfill({ status: 200, contentType: "video/mp4", body: Buffer.from([]) }),
  );
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /hydration|Minified React error/.test(m.text()))
      errors.push(m.text());
  });
  const quick = page.locator("dialog.movie-quick-view"),
    catalog = `/catalog?studio=${encodeURIComponent(studio)}`;
  const openCatalog = async () => {
    await page.goto(base + catalog);
    await page.locator(".film-card").first().waitFor();
    await page.waitForFunction(
      () =>
        document.querySelector(".app-shell")?.getAttribute("data-hud-busy") ===
        "false",
    );
  };
  const openQuick = async () => {
    const card = page.locator(".film-card").first();
    await card.focus();
    await page.keyboard.press("Enter");
    await quick.waitFor();
  };
  const closed = async () => {
    await quick.waitFor({ state: "detached" });
    await page.waitForFunction(() => !history.state?.moviemovieQuickView);
  };
  await openCatalog();
  await page.locator(".film-card").first().focus();
  const route = page.url();
  const scroll = await page.evaluate(() => scrollY);
  await openQuick();
  assert.equal(page.url(), route);
  assert.equal(
    await quick.locator("video,iframe").count(),
    0,
    "No player until explicit trailer action",
  );
  assert.equal(
    await page.evaluate(() => document.body.style.overflow),
    "hidden",
  );
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    assert(
      await quick.evaluate((e) => e.contains(document.activeElement)),
      "Quick-view keyboard trap",
    );
  }
  await page.goBack();
  await closed();
  assert.equal(page.url(), route);
  await page.waitForFunction((y) => Math.abs(scrollY - y) < 3, scroll);
  assert(Math.abs((await page.evaluate(() => scrollY)) - scroll) < 3);
  assert(
    await page
      .locator(".film-card")
      .first()
      .evaluate((e) => e === document.activeElement),
  );
  await page.goForward();
  await quick.waitFor();
  await page.keyboard.press("Escape");
  await closed();
  await openQuick();
  await quick.getByRole("button", { name: "Трейлер", exact: true }).click();
  await quick.locator("video").waitFor();
  assert.equal(await quick.locator("video").getAttribute("autoplay"), null);
  await page.keyboard.press("Escape");
  await quick.locator("video").waitFor({ state: "detached" });
  assert(await quick.isVisible());
  await page.keyboard.press("Escape");
  await closed();
  assert.equal(await page.evaluate(() => document.body.style.overflow), "");
  await openQuick();
  await quick
    .getByRole("button", { name: "Буду смотреть", exact: true })
    .click();
  await page.locator(".auth-modal").waitFor();
  await closed();
  await page.locator(".auth-modal .modal-close").click();
  // Full detail replaces the temporary quick-view entry. Browser Back returns to the filtered catalog.
  await openQuick();
  const movieHref = await quick
    .getByRole("link", { name: "Полная карточка", exact: true })
    .getAttribute("href");
  await quick
    .getByRole("link", { name: "Полная карточка", exact: true })
    .click();
  await page.waitForURL("**" + movieHref);
  await page.locator(".movie-detail-page").waitFor();
  assert.equal(await quick.count(), 0);
  await page.goBack();
  await page.waitForURL("**/catalog?studio=*");
  await page.locator(".film-card").first().waitFor();
  assert.equal(await quick.count(), 0);
  // Signed-in actions use the existing real handler and ownership, not local-only state.
  const signup = await context.request.post(base + "/api/auth", {
    data: {
      action: "register",
      email: `quick-${stamp}@example.test`,
      username: `Quick${stamp}`,
      password: "isolated-quick-view-password",
    },
  });
  assert.equal(signup.status(), 200);
  userId = (await signup.json()).user.id;
  await openCatalog();
  await openQuick();
  let currentId = Number(
    (
      await quick
        .getByRole("link", { name: "Полная карточка", exact: true })
        .getAttribute("href")
    )
      .split("/")
      .at(-1),
  );
  const save = quick.locator(".quick-save");
  await save.click();
  await page.waitForFunction(
    () =>
      document.querySelector(".quick-save")?.getAttribute("aria-pressed") ===
        "true" && !document.querySelector(".quick-save")?.disabled,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from mg_bookmarks where user_id=$1 and movie_id=$2",
        [userId, currentId],
      )
    ).rows[0].n,
    1,
  );
  const favorite = quick.locator(".quick-favorite");
  await favorite.click();
  await page.waitForFunction(
    () =>
      document
        .querySelector(".quick-favorite")
        ?.getAttribute("aria-pressed") === "true" &&
      !document.querySelector(".quick-favorite")?.disabled,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from mg_favorites where user_id=$1 and movie_id=$2",
        [userId, currentId],
      )
    ).rows[0].n,
    1,
  );
  await favorite.click();
  await page.waitForFunction(
    () =>
      document
        .querySelector(".quick-favorite")
        ?.getAttribute("aria-pressed") === "false" &&
      !document.querySelector(".quick-favorite")?.disabled,
  );
  await context.route("**/api/action", (r) =>
    r.fulfill({
      status: 500,
      json: { error: "Intentional quick-view failure" },
    }),
  );
  await save.click();
  await quick.getByRole("alert").waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector(".quick-save")?.getAttribute("aria-pressed") ===
        "true" && !document.querySelector(".quick-save")?.disabled,
  );
  await context.unroute("**/api/action");
  // Responsive top layer, long text scrolling, no overlap with sticky mobile controls.
  for (const theme of ["dark", "light"]) {
    await page.evaluate(
      (t) => (document.documentElement.dataset.theme = t),
      theme,
    );
    for (const width of [
      1920, 1440, 1280, 1024, 800, 761, 760, 600, 390, 360, 320,
    ]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(160);
      const b = await quick.boundingBox();
      assert(
        b.x >= 0 &&
          b.y >= 0 &&
          b.x + b.width <= width + 1 &&
          b.y + b.height <= 900,
        `${theme}/${width} dialog bounds`,
      );
      assert(
        await quick.evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        `${theme}/${width} dialog overflow`,
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${theme}/${width} page overflow`,
      );
      if ([1440, 390].includes(width))
        await page.screenshot({ path: `${shots}/quick-${theme}-${width}.png` });
    }
  }
  await page.keyboard.press("Escape");
  await closed();
  assert.equal(await page.evaluate(() => document.body.style.overflow), "");
  // Explicit refresh of an open preview returns to a clean background route.
  await openQuick();
  await page.reload();
  await page.locator(".film-card").first().waitFor();
  assert.equal(await quick.count(), 0);
  assert.equal(
    await page.evaluate(() => !!history.state?.moviemovieQuickView),
    false,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base);
  await page.locator(".spotlight-story h1").waitFor();
  const old = await page.locator(".spotlight-story h1").innerText();
  await page
    .getByRole("button", { name: "Следующая история", exact: true })
    .click();
  assert.notEqual(await page.locator(".spotlight-story h1").innerText(), old);
  await page.screenshot({ path: `${shots}/home-member.png` });
  assert(
    (await page.locator(".launchpad-saved a").count()) > 0,
    "Signed-in homepage uses the real saved shelf",
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from mg_watches where user_id=$1",
        [userId],
      )
    ).rows[0].n,
    0,
    "Preview must never auto-mark watched",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS cinema experience: quick look preserves route/filter/scroll/focus; Back/Forward/reload/full-page history; explicit trailer; guest auth; real bookmark/favorite persistence and rollback; no automatic watches; 11 widths × two themes; manual spotlight and adaptive saved shelf.",
  );
  await context.close();
} finally {
  if (userId) {
    await db.query("delete from mg_bookmarks where user_id=$1", [userId]);
    await db.query("delete from mg_favorites where user_id=$1", [userId]);
  }
  if (ids.length)
    await db.query("delete from mg_movies where id=any($1::int[])", [ids]);
  await browser.close();
  await db.end();
}
