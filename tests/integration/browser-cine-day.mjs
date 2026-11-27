// Public production app only; no writes or external network are needed.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
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
    (arg) => !["--single-process", "--disable-web-security"].includes(arg),
  ),
  headless: true,
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(() => {
    localStorage.setItem("mg_season_mode", "off");
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      /hydration|Minified React error/i.test(m.text())
    )
      errors.push(m.text());
  });
  let snapshot;
  let firstTag;
  for (let i = 0; i < 8; i++) {
    const response = await context.request.get(base + "/api/data");
    assert.equal(response.status(), 200);
    snapshot = await response.json();
    const counts = new Map();
    for (const film of snapshot.films) {
      for (const genre of new Set(
        (film.genre || "")
          .split(",")
          .map((g) => g.trim().toLocaleLowerCase())
          .filter((g) => g && g !== "все жанры"),
      ))
        counts.set(genre, (counts.get(genre) || 0) + 1);
    }
    if (!counts.size) {
      assert.equal(snapshot.cineDay, null);
      continue;
    }
    assert(snapshot.cineDay);
    firstTag ??= snapshot.cineDay.filter;
    assert.equal(
      snapshot.cineDay.filter,
      firstTag,
      "Repeated requests keep the same daily tag",
    );
    assert.equal(
      snapshot.cineDay.count,
      counts.get(snapshot.cineDay.filter.toLocaleLowerCase()),
    );
    const url = new URL(snapshot.cineDay.href, base);
    assert.equal(url.pathname, "/catalog");
    assert.equal(url.searchParams.get("genre"), snapshot.cineDay.filter);
  }
  assert(
    snapshot.films.length > 0,
    "Requires the populated isolated audit fixture",
  );
  await page.route("**/api/data", (route) => route.fulfill({ json: snapshot }));
  const banner = page.locator(".cine-day-banner");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base);
    await banner.getByText(snapshot.cineDay.filter, { exact: true }).waitFor();
    await banner.getByRole("link", { name: "Открыть", exact: true }).waitFor();
    assert.equal(
      await banner
        .getByRole("button", { name: "Другой тег", exact: true })
        .count(),
      0,
    );
    assert(
      await banner.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.left >= 0 &&
          r.right <= innerWidth + 1 &&
          [...el.querySelectorAll("button,a")].every((n) => {
            const b = n.getBoundingClientRect();
            return b.left >= r.left && b.right <= r.right + 1;
          })
        );
      }),
      `banner bounds ${width}`,
    );
    const href = await banner
      .getByRole("link", { name: "Открыть", exact: true })
      .getAttribute("href");
    // A draft in global search must not silently narrow the genre collection to zero.
    await page.locator(".top-search input").fill("NoMatchCineDayDraftXYZ");
    await banner.getByRole("link", { name: "Открыть", exact: true }).click();
    await page.waitForURL("**/catalog?genre=*");
    assert.equal(new URL(page.url()).search, new URL(href, base).search);
    await page.locator(".film-card").first().waitFor();
    const genre = new URL(page.url()).searchParams.get("genre");
    assert.equal(await page.locator(".catalog-search input").inputValue(), "");
    const expected = snapshot.films.filter((f) =>
      (f.genre || "")
        .split(",")
        .some(
          (g) => g.trim().toLocaleLowerCase() === genre.toLocaleLowerCase(),
        ),
    ).length;
    assert.equal(await page.locator(".film-card").count(), expected);
  }
  await page.unroute("**/api/data");
  // Single-tag and absent-tag states, using explicit response fixtures without DB mutations.
  for (const genre of ["Уникальный & тег + #?", ""]) {
    const film = { ...snapshot.films[0], genre };
    await page.route("**/api/data", (route) =>
      route.fulfill({
        json: {
          ...snapshot,
          films: [film],
          cineDay: genre
            ? {
                label: genre,
                filter: genre,
                icon: "🎬",
                href: "/catalog?" + new URLSearchParams({ genre }),
                count: 1,
              }
            : null,
        },
      }),
    );
    const loaded = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/data",
    );
    await page.goto(base);
    await loaded;
    if (genre) {
      await banner.getByText(genre, { exact: true }).waitFor();
      assert.equal(
        await banner.getByRole("button", { name: "Другой тег" }).count(),
        0,
      );
      const href = await banner
        .getByRole("link", { name: "Открыть" })
        .getAttribute("href");
      assert.equal(new URL(href, base).searchParams.get("genre"), genre);
    } else {
      await page.waitForFunction(
        () => !document.querySelector(".cine-day-banner"),
      );
    }
    await page.unroute("**/api/data");
  }
  // An already-open tab switches at Moscow midnight without refresh or a reroll button.
  await page.route("**/api/data", (route) => route.fulfill({ json: snapshot }));
  await page.clock.install({ time: new Date() });
  await page.goto(base);
  await banner.locator("b").waitFor();
  // Advance monotonic time instead of moving the wall clock backwards (which postpones old timers).
  const start = await page.evaluate(() => Date.now());
  const midnight = new Date(start);
  midnight.setUTCHours(21, 0, 0, 0);
  if (midnight.getTime() <= start)
    midnight.setUTCDate(midnight.getUTCDate() + 1);
  await page.clock.fastForward(midnight.getTime() - start - 10000);
  const beforeMidnight = await banner.locator("b").innerText();
  await page.clock.runFor(40000);
  assert.notEqual(await banner.locator("b").innerText(), beforeMidnight);
  assert.equal(await banner.getByRole("button").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "Passed current-catalog daily tags: API suggestions always populated; no reroll, stable repeated requests and automatic Moscow-midnight rollover; real exact-genre navigation/counts at 320/390/768/1440; stale search does not leak; encoded tags, single-tag and no-tag states; no hydration errors.",
  );
} finally {
  await browser.close();
}
