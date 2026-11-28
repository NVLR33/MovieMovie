// Real production shell and navigation; controlled public preview data, no DB writes.
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
const leaders = Array.from({ length: 3 }, (_, i) => ({
  id: 90001 + i,
  username: i
    ? "Зритель " + i
    : "Очень длинное имя любителя кино без сокращений",
  avatar: null,
  level: i + 2,
  watches: 12 - i,
}));
const question = {
  id: "community-layout-fixture",
  date: "2026-11-22",
  movieId: snapshot.films[0]?.id || 1,
  title:
    "Очень длинное название фильма, которое переносится на несколько строк",
  options: ["2001", "2002", "2003", "2004"],
  correct: "2001",
};
const browser = await pw.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter(
    (a) => !["--single-process", "--disable-web-security"].includes(a),
  ),
  headless: true,
});
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    }),
    page = await context.newPage(),
    errors = [],
    writes = [];
  page.on("pageerror", (e) => errors.push(e.message));
  context.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/action") writes.push(r.postData());
  });
  let count = 1,
    hasQuestion = true,
    signedIn = false;
  const data = () => ({
    ...snapshot,
    user: signedIn
      ? {
          id: 90001,
          username: "Киноман",
          role: "visitor",
          xp: 500,
          createdAt: "2026-01-01T00:00:00Z",
        }
      : null,
    weeklyLeaders: leaders.slice(0, count),
    dailyGame: hasQuestion ? question : null,
  });
  await context.route("**/api/data", (r) => r.fulfill({ json: data() }));
  await context.route("**/api/pulse*", (r) =>
    r.fulfill({
      json: {
        films: snapshot.films,
        weeklyLeaders: leaders.slice(0, count),
        weeklyPulse: snapshot.weeklyPulse,
      },
    }),
  );
  const section = page.locator(".community-section");
  const open = async () => {
    await page.goto(base);
    await section
      .getByRole("heading", { name: "Кино лучше вместе", exact: true })
      .waitFor();
    await section.locator(".community-card").last().waitFor();
    await section
      .locator(hasQuestion ? ".daily-game-question" : ".community-unavailable")
      .waitFor();
  };
  const geometry = async (width) => {
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `page overflow ${width}`,
    );
    const boxes = await section.locator(".community-card").evaluateAll((els) =>
      els.map((el) => {
        const b = el.getBoundingClientRect(),
          h = el.querySelector(".community-card-body").getBoundingClientRect(),
          f = el
            .querySelector(".community-card-footer")
            .getBoundingClientRect();
        return {
          top: b.top,
          bottom: b.bottom,
          height: b.height,
          body: h.top,
          footer: f.top,
          width: b.width,
          scroll: el.scrollWidth,
          client: el.clientWidth,
        };
      }),
    );
    assert.equal(boxes.length, 3);
    boxes.forEach((b) =>
      assert(b.scroll <= b.client + 1, `card overflow ${width}`),
    );
    if (width > 1100) {
      for (const field of ["top", "bottom", "height", "body", "footer"])
        assert(
          Math.max(...boxes.map((b) => b[field])) -
            Math.min(...boxes.map((b) => b[field])) <
            2,
          `${field} alignment ${width}`,
        );
    } else {
      assert(
        boxes[1].top >= boxes[0].bottom && boxes[2].top >= boxes[1].bottom,
        `stacked ${width}`,
      );
    }
  };
  await mkdir("/tmp/mm-community-screenshots", { recursive: true });
  for (const n of [0, 1, 3]) {
    count = n;
    await open();
    assert.equal(await section.locator(".weekly-leader").count(), n);
    if (!n)
      await section
        .getByText(/За последние 7 дней пока нет просмотров/)
        .waitFor();
    for (const theme of ["dark", "light"]) {
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      for (const width of [320, 360, 390, 600, 760, 1024, 1280, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        await geometry(width);
      }
    }
  }
  // Quiz feedback expands a shared content row; CTA baseline remains aligned.
  await page.setViewportSize({ width: 1440, height: 1000 });
  const before = await page.evaluate(
    () =>
      document.querySelector(".community-card").getBoundingClientRect().height,
  );
  await section.getByRole("button", { name: "2002", exact: true }).click();
  await section
    .getByRole("status")
    .getByText(/Правильный ответ — 2001/)
    .waitFor();
  assert.equal(await section.locator(".daily-game-option:disabled").count(), 4);
  await geometry(1440);
  assert(
    (await section.locator(".community-card").first().boundingBox()).height >=
      before,
  );
  await page.reload();
  await section.locator(".daily-game-option.is-incorrect").waitFor();
  assert.equal(await section.locator(".daily-game-option:disabled").count(), 4);
  // Bottom actions have a common reachable focus target and retain real navigation.
  await section
    .getByRole("button", { name: "Найти друзей", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page.locator(".auth-modal").waitFor();
  await page.keyboard.press("Escape");
  for (const [name, path] of [
    ["Подборки сообщества", "/collab"],
    ["Обсудить фильм", "/catalog"],
    ["Все мини-игры", "/games"],
    ["Вся таблица лидеров", "/leaderboard"],
  ]) {
    await open();
    await section.getByRole("button", { name: new RegExp(name) }).click();
    await page.waitForURL(base + path);
  }
  signedIn = true;
  await open();
  await section
    .getByRole("button", { name: "Найти друзей", exact: true })
    .click();
  await page.waitForURL(base + "/friends");
  // Empty game is an honest unavailable state, with a working games link.
  signedIn = false;
  hasQuestion = false;
  await open();
  await section.getByText(/Вопрос дня пока недоступен/).waitFor();
  assert.equal(await section.locator(".daily-game-option").count(), 0);
  await geometry(1440);
  hasQuestion = true;
  await page.evaluate(() => localStorage.removeItem("mg_daily_game"));
  await open();
  for (const theme of ["dark", "light"]) {
    await page.evaluate(
      (theme) => (document.documentElement.dataset.theme = theme),
      theme,
    );
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1100 });
      await section.scrollIntoViewIfNeeded();
      await section.screenshot({
        style: ".topbar, .mobile-bottom-nav {visibility:hidden!important;}",
        animations: "disabled",
        path: `/tmp/mm-community-screenshots/community-${theme}-${width}.png`,
      });
    }
  }
  // English copy and long question/username must not break shared rows.
  await page.evaluate(() => localStorage.setItem("mg_lang", "en"));
  await page.reload();
  await section
    .getByRole("heading", { name: "Movies are better together", exact: true })
    .waitFor();
  await geometry(1440);
  assert.deepEqual(writes, [], "The preview quiz never posts scores or XP");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: community shared heights/content/action baselines, 9 widths, dark/light, 0/1/3 real-data-shaped leaders, long names/questions, answered/reloaded/unavailable quiz, no score writes, guest/signed-in navigation, keyboard and English. Controlled API fixtures; no production DB writes.",
  );
} finally {
  await browser.close();
}
