// Production UI with disposable fixtures in the marker-guarded isolated local DB only.
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
    (arg) => !["--single-process", "--disable-web-security"].includes(arg),
  ),
  headless: true,
});
const ids = [];
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const title =
    "Доктор Стрэндж в мультивселенной безумия: путешествие за пределы реальности и возвращение домой";
  const description =
    "Когда привычный мир перестаёт быть безопасным, героям предстоит найти путь домой. История о выборе, доверии и цене второго шанса.\n".repeat(
      12,
    );
  async function fixture(category, text = description, name = title) {
    const id = (
      await db.query(
        `insert into mg_movies(title,description,original_title,category,genre,studio,year,duration,poster,backdrop,"cast",country) values($1,$2,'Doctor Strange in the Multiverse of Madness',$3,'Фэнтези, Боевик, Приключения, Фантастика, Драма, Детектив','Marvel Studios, Очень длинное название студии без сокращений',2022,126,'/brand/moviemovie-logo.png','/brand/moviemovie-logo.png','Бенедикт Камбербэтч, Элизабет Олсен, Бенедикт Вонг, Рэйчел Макадамс, Патрик Стюарт','США') returning id`,
        [name, text, category],
      )
    ).rows[0].id;
    ids.push(id);
    return id;
  }
  const film = await fixture("Фильм"),
    series = await fixture("Сериал"),
    short = await fixture("Фильм", "Короткое описание.", "Короткое название");
  for (const n of [1, 2]) {
    const sid = (
      await db.query(
        "insert into mg_series_seasons(movie_id,number,title)values($1,$2,$3)returning id",
        [series, n, n === 1 ? "Начало" : "Возвращение"],
      )
    ).rows[0].id;
    await db.query(
      "insert into mg_series_episodes(season_id,number,title)values($1,1,'Первый эпизод')",
      [sid],
    );
  }
  await mkdir("/tmp/mm-detail-screenshots", { recursive: true });
  const open = async (id) => {
    await page.goto(`${base}/movie/${id}`);
    await page.locator(".detail-intro h1").waitFor();
    await page.locator(".detail-text-toggle").waitFor();
  };
  for (const width of [320, 360, 390, 600, 760, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await open(film);
    assert.equal(await page.locator(".detail-intro h1").innerText(), title);
    assert.equal(
      await page
        .locator(".detail-hero")
        .getByRole("button", { name: /Мнения сообщества|Кинозал/ })
        .count(),
      0,
    );
    assert.equal(
      await page
        .locator(".detail-hero")
        .getByRole("link", { name: /Искать сеансы/ })
        .count(),
      0,
    );
    assert.equal(await page.locator(".detail-seasons-trigger").count(), 0);
    const synopsis = page.locator(".detail-description p");
    const before = await synopsis.evaluate((el) => ({
      height: el.clientHeight,
      line: parseFloat(getComputedStyle(el).lineHeight),
    }));
    assert(before.height <= before.line * 3 + 2, `clamp ${width}`);
    await page
      .getByRole("button", { name: "Полное описание", exact: true })
      .click();
    assert((await synopsis.boundingBox()).height > before.height * 2);
    await page
      .getByRole("button", { name: "Свернуть описание", exact: true })
      .click();
    assert.equal(await page.locator(".genre-list button:visible").count(), 4);
    await page.getByRole("button", { name: "Ещё 4", exact: true }).click();
    assert.equal(await page.locator(".genre-list button:visible").count(), 8);
    await page.locator(".detail-tag-more").click();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `overflow ${width}`,
    );
    const rectangles = await page
      .locator(".detail-hero button:visible")
      .evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, width: r.width };
        }),
      );
    assert(
      rectangles.every(
        (r) => r.left >= 0 && r.right <= width + 1 && r.width > 0,
      ),
      `buttons ${width}`,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    if ([390, 1440].includes(width))
      await page.screenshot({
        path: `/tmp/mm-detail-screenshots/movie-${width}.png`,
        fullPage: true,
      });
  }
  await page
    .getByRole("button", { name: "Написать комментарий", exact: true })
    .click();
  const comments = page.getByRole("dialog", {
    name: "Комментарии",
    exact: true,
  });
  await comments.waitFor();
  await page
    .getByRole("textbox", { name: "Текст отзыва", exact: true })
    .fill("Черновик комментария");
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .locator(".detail-comments-button")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.locator(".detail-comments-button").click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Текст отзыва", exact: true })
      .inputValue(),
    "Черновик комментария",
  );
  await page.keyboard.press("Escape");
  await page.goto(`${base}/movie/${short}`);
  await page.locator(".detail-intro h1").waitFor();
  assert.equal(await page.locator(".detail-text-toggle").count(), 0);
  for (const width of [320, 390, 760, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage))
        if (key.startsWith("mg_series_season:")) localStorage.removeItem(key);
    });
    await open(series);
    assert.equal(
      await page.locator(".series-panel").count(),
      0,
      "No permanently expanded series block",
    );
    const trigger = page.locator(".detail-seasons-trigger");
    await trigger.click();
    const dialog = page.locator(".series-browser[open]");
    await dialog.waitFor();
    await page
      .getByRole("heading", { name: "Сезон 1 · Начало", exact: true })
      .waitFor();
    assert.equal(await dialog.locator(".series-season").count(), 1);
    assert.equal(
      await dialog.locator(".series-completion").getAttribute("open"),
      null,
    );
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      assert(
        await dialog.evaluate((el) => el.contains(document.activeElement)),
      );
    }
    assert(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      `dialog width ${width}`,
    );
    assert(
      await dialog.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.left >= 0 && r.right <= innerWidth + 1 && r.height <= innerHeight
        );
      }),
    );
    await dialog
      .getByRole("button", { name: "Сезон 2 1 эп.", exact: true })
      .click();
    await dialog
      .getByRole("heading", { name: "Сезон 2 · Возвращение", exact: true })
      .waitFor();
    await page.screenshot({
      path: `/tmp/mm-detail-screenshots/seasons-${width}.png`,
    });
    await page.keyboard.press("Escape");
    assert.equal(
      await trigger.evaluate((el) => el === document.activeElement),
      true,
    );
    assert.notEqual(
      await page.evaluate(() => document.body.style.overflow),
      "hidden",
    );
  }
  const response = await page.goto(`${base}/movie/${series}?season=2`);
  assert.equal(response.status(), 200);
  await page.locator(".series-browser[open]").waitFor();
  await page
    .getByRole("heading", { name: "Сезон 2 · Возвращение", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Войти для оценки", exact: true })
    .first()
    .click();
  await page.locator(".auth-modal").waitFor();
  assert.equal(
    await page.locator(".series-browser").count(),
    0,
    "Guest auth closes the season modal",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: material layout 8 widths, full adaptive title, real three-line synopsis/reveal, four visible tags/reveal, removed header actions, comment draft/focus, compact seasons modal/keyboard/deep-link/guest auth.",
  );
} finally {
  if (ids.length)
    await db.query("delete from mg_movies where id=any($1::int[])", [ids]);
  await browser.close();
  await db.end();
}
