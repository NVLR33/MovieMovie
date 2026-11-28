// Real pet API + production UI, isolated marker-guarded local database only.
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
const users = [],
  shots = "/tmp/mm-pet-screenshots",
  capture = process.env.PET_SCREENSHOTS === "1";
if (capture) await mkdir(shots, { recursive: true });
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
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
    });
  const stamp = Date.now(),
    registration = await context.request.post(base + "/api/auth", {
      data: {
        action: "register",
        email: `pet-${stamp}@example.test`,
        username: "Pet" + stamp,
        password: "isolated-pet-password",
      },
    });
  assert.equal(registration.status(), 200);
  const me = (await registration.json()).user;
  users.push(me.id);
  const page = await context.newPage(),
    errors = [],
    posts = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/pet" && r.method() === "POST")
      posts.push(r.postDataJSON());
  });
  const studio = page.locator(".pet-workspace-studio");
  const snapshot = async () =>
    (await (await context.request.get(base + "/api/pet")).json()).pet;
  const load = async () => {
    await page.goto(base + "/profile");
    await page.waitForFunction(
      () =>
        document.querySelector(".app-shell")?.getAttribute("data-hud-busy") ===
          "false" &&
        document.querySelectorAll(".personal-profile").length === 1,
    );
    await page
      .getByRole("button", { name: "Кинопитомец и попкорн", exact: true })
      .click();
    await studio.waitFor({ state: "attached" });
    await studio.scrollIntoViewIfNeeded();
    await studio.waitFor();
    await page.waitForFunction(
      () => document.querySelectorAll(".pet-workspace-studio").length === 1,
    );
    await studio
      .locator(".pet-adoption,.pet-workspace,.pet-error")
      .first()
      .waitFor();
  };
  const refresh = async (balance) => {
    const response = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/pet" &&
        r.request().method() === "GET" &&
        !new URL(r.url()).search,
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    assert.equal((await response).status(), 200);
    await page.waitForFunction(
      (balance) =>
        Number(
          document
            .querySelector(".pet-wallet b")
            ?.textContent.replace(/\D/g, ""),
        ) === balance,
      balance,
    );
  };
  const section = async (label) => {
    await studio
      .locator(".pet-tabs")
      .getByRole("button", { name: label, exact: true })
      .click();
    await page.waitForTimeout(50);
  };
  const act = async (button, action) => {
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === "/api/pet" &&
          r.request().method() === "POST" &&
          r.request().postDataJSON()?.action === action,
      ),
      button.click(),
    ]);
    assert.equal(response.status(), 200);
    await page.waitForFunction(
      () =>
        document
          .querySelector(".pet-workspace-studio")
          ?.getAttribute("aria-busy") === "false",
    );
  };
  let failGet = true;
  await page.route("**/api/pet", async (route) => {
    if (route.request().method() === "GET" && failGet) {
      failGet = false;
      await route.fulfill({
        status: 503,
        json: { error: "Тестовая ошибка загрузки" },
      });
    } else await route.continue();
  });
  await load();
  await studio
    .getByRole("alert")
    .filter({ hasText: "Тестовая ошибка загрузки" })
    .waitFor();
  await studio.getByRole("button", { name: "Обновить", exact: true }).click();
  await studio.locator(".pet-adoption").waitFor();
  assert.equal(posts.length, 0, "Opening the studio never adopts or spends");
  assert.equal((await snapshot()).adopted, false);
  if (capture) await studio.screenshot({ path: shots + "/adoption.png" });
  for (const width of [320, 390, 760, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(
      await studio.evaluate(
        (root) =>
          document.documentElement.scrollWidth <=
            document.documentElement.clientWidth + 1 &&
          [...root.querySelectorAll("button")].every(
            (b) =>
              b.getBoundingClientRect().right <=
              document.documentElement.clientWidth + 1,
          ),
      ),
      `Adoption/${width}`,
    );
  }
  await page.unroute("**/api/pet");
  let failed = false;
  await page.route("**/api/pet", async (route) => {
    if (route.request().method() === "POST" && !failed) {
      failed = true;
      await route.fulfill({
        status: 409,
        json: { error: "Тестовая ошибка операции" },
      });
    } else await route.continue();
  });
  await studio.getByRole("button", { name: /Начать дружбу/ }).click();
  await studio
    .getByRole("alert")
    .filter({ hasText: "Тестовая ошибка операции" })
    .waitFor();
  assert.equal(
    (await snapshot()).adopted,
    false,
    "A failed response must not optimistically adopt",
  );
  await page.unroute("**/api/pet");
  await act(studio.getByRole("button", { name: /Начать дружбу/ }), "adopt");
  await studio.locator(".pet-workspace").waitFor();
  assert.equal((await snapshot()).balance, 30);
  await studio
    .locator(".pet-tabs")
    .getByRole("button", { name: "Кошелёк", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await studio.locator(".popcorn-wallet-panel").waitFor();
  await section("Забота");
  const feed = studio
    .locator(".pet-care-action")
    .filter({ hasText: "Угостить" });
  await act(feed, "care");
  assert.equal((await snapshot()).balance, 22);
  assert(await feed.isDisabled());
  assert.match(await feed.innerText(), /Сегодня уже сделано/);
  assert(
    await studio
      .locator(".pet-care-action")
      .filter({ hasText: "Обучить" })
      .isDisabled(),
  );
  await act(
    studio.locator(".pet-care-action").filter({ hasText: "Поиграть" }),
    "care",
  );
  assert.equal((await snapshot()).balance, 10);
  await section("Гардероб");
  assert(
    await studio
      .locator(".pet-shop-item")
      .filter({ hasText: "Бабочка" })
      .getByRole("button")
      .isDisabled(),
  );
  // Supply explicit test ledger entries, not fake watches, to exercise collecting and spending.
  await db.query(
    "insert into mg_popcorn_ledger(user_id,source_key,kind,delta) select $1,'fixture:'||g,'collect',1 from generate_series(1,25) g",
    [me.id],
  );
  await db.query(
    "update mg_cinema_pets set balance=balance+25,last_collected_at=now()-interval '3 hours' where user_id=$1",
    [me.id],
  );
  await refresh(35);
  await act(
    studio
      .locator(".pet-projector")
      .getByRole("button", { name: "Забрать", exact: true }),
    "collect",
  );
  assert.equal((await snapshot()).balance, 41);
  assert(await studio.locator(".pet-projector button").isDisabled());
  await section("Гардероб");
  const bowtie = studio
    .locator(".pet-shop-item")
    .filter({ hasText: "Бабочка" });
  await act(bowtie.getByRole("button"), "buy");
  assert.equal((await snapshot()).balance, 1);
  assert.equal((await snapshot()).accessory, "bowtie");
  assert(await bowtie.getByRole("button", { name: "Выбрано" }).isDisabled());
  await act(
    studio.getByRole("button", { name: "Снять аксессуар", exact: true }),
    "equip",
  );
  await act(
    bowtie.getByRole("button", { name: "Надеть", exact: true }),
    "equip",
  );
  assert.equal((await snapshot()).balance, 1, "Owned equipment is free");
  await section("Забота");
  assert.match(
    await studio
      .locator(".pet-care-action")
      .filter({ hasText: "Обучить" })
      .innerText(),
    /С 3 уровня/,
  );
  await section("Кошелёк");
  await page.waitForFunction(
    () => document.querySelectorAll(".popcorn-history li").length === 20,
  );
  await studio
    .getByRole("button", { name: "Ещё 20 операций", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll(".popcorn-history li").length > 20,
  );
  const operations = await studio
    .locator(".popcorn-history li > div > small")
    .allTextContents();
  assert.equal(
    new Set(operations).size,
    operations.length,
    "Cursor pagination never duplicates operations",
  );
  let historyFailure = true;
  await page.route("**/api/pet?history=1&filter=expense", async (route) => {
    if (historyFailure) {
      historyFailure = false;
      await route.fulfill({
        status: 503,
        json: { error: "История временно недоступна" },
      });
    } else await route.continue();
  });
  await studio
    .getByRole("group", { name: "Фильтр операций" })
    .getByRole("button", { name: "Расходы", exact: true })
    .click();
  await studio
    .getByRole("button", { name: "Повторить загрузку", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll(".popcorn-history li").length === 3,
  );
  assert(
    (
      await studio.locator(".popcorn-history li > span").allTextContents()
    ).every((t) => t.includes("−") || t.includes("-")),
  );
  await studio
    .getByRole("group", { name: "Фильтр операций" })
    .getByRole("button", { name: "Доходы", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll(".popcorn-history li").length === 20,
  );
  assert(
    (
      await studio.locator(".popcorn-history li > span").allTextContents()
    ).every((t) => t.includes("+")),
  );
  // Goal selection is only a plan; claims remain gated when no eligible real activity exists.
  const goal = studio.getByLabel("Цель этого сеанса"),
    postCount = posts.length;
  await goal.selectOption("accessory:glasses");
  assert.equal(posts.length, postCount);
  assert(await studio.locator(".popcorn-goal button").isDisabled());
  assert.equal(
    await studio.locator(".popcorn-challenge button:not(:disabled)").count(),
    0,
  );
  // A funded upgrade uses expectedLevel; the new goal advances to the next price.
  await db.query(
    "insert into mg_popcorn_ledger(user_id,source_key,kind,delta) values($1,'fixture:fund','collect',500)",
    [me.id],
  );
  await db.query(
    "update mg_cinema_pets set balance=balance+500 where user_id=$1",
    [me.id],
  );
  await refresh(501);
  await section("Кинозал");
  await act(
    studio
      .locator(".pet-upgrade")
      .filter({ hasText: "Проектор" })
      .getByRole("button"),
    "upgrade",
  );
  assert.equal((await snapshot()).projectorLevel, 1);
  assert.equal((await snapshot()).balance, 441);
  assert.deepEqual(posts.at(-1), {
    action: "upgrade",
    kind: "projector",
    expectedLevel: 0,
  });
  await section("Кошелёк");
  assert.match(
    await studio.getByLabel("Цель этого сеанса").inputValue(),
    /projector:1/,
  );
  await studio
    .getByLabel("Цель этого сеанса")
    .selectOption("accessory:glasses");
  await act(studio.locator(".popcorn-goal button"), "buy");
  assert.equal((await snapshot()).accessory, "glasses");
  assert.equal((await snapshot()).balance, 381);
  // Privacy and customization are server-confirmed; public payloads contain no wallet fields.
  const publicPet = (
    await (await guest.request.get(base + `/api/pet?userId=${me.id}`)).json()
  ).pet;
  assert(publicPet);
  for (const key of [
    "balance",
    "ledger",
    "economy",
    "owned",
    "cared",
    "dailyCounts",
  ])
    assert(!(key in publicPet));
  const publicPage = await guest.newPage();
  await publicPage.goto(base + `/user/${me.id}`);
  await publicPage.locator(".public-cinema-pet").waitFor();
  await publicPage.close();
  await page.bringToFront();
  await page.waitForTimeout(200);
  await studio.locator(".pet-personalize summary").click();
  await studio
    .getByLabel("Имя питомца", { exact: true })
    .fill("ДругБольшогоКино");
  await studio
    .getByRole("combobox", { name: /Финальный образ/ })
    .selectOption("monster");
  await studio
    .getByLabel("Показывать питомца другим зрителям", { exact: true })
    .uncheck();
  await act(
    studio.getByRole("button", { name: "Сохранить образ", exact: true }),
    "customize",
  );
  assert.equal((await snapshot()).name, "ДругБольшогоКино");
  assert.equal((await snapshot()).branch, "monster");
  assert.equal(
    (await (await guest.request.get(base + `/api/pet?userId=${me.id}`)).json())
      .pet,
    null,
  );
  const hiddenPage = await guest.newPage();
  const hiddenResponse = hiddenPage.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/pet" &&
      new URL(r.url()).searchParams.get("userId") === String(me.id),
  );
  await hiddenPage.goto(base + `/user/${me.id}`);
  assert.equal((await hiddenResponse).status(), 200);
  await hiddenPage.locator(".public-profile").waitFor();
  assert.equal(await hiddenPage.locator(".public-cinema-pet").count(), 0);
  await hiddenPage.close();
  await page.bringToFront();
  await page.setViewportSize({ width: 390, height: 1000 });
  await studio.locator(".pet-wallet").click();
  await studio.locator(".pet-desk-heading h3:focus").waitFor();
  await studio.locator(".pet-room-link").click();
  await studio
    .locator('.pet-tabs button[aria-pressed="true"]')
    .filter({ hasText: "Кинозал" })
    .waitFor();
  // Same UI in all site themes and widths: every desk, no horizontal clipping or offscreen controls.
  const beforeBrowse = posts.length;
  for (const theme of ["dark", "light", "pink", "purple", "yellow"]) {
    await page.evaluate(
      (t) => (document.documentElement.dataset.theme = t),
      theme,
    );
    for (const width of [320, 360, 390, 600, 760, 1000, 1182, 1440]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.waitForTimeout(400); // Let the responsive shell finish its resize transition.
      for (const label of [
        "Забота",
        "Кошелёк",
        "Кинозал",
        "Гардероб",
        "Развитие",
      ]) {
        // Functional pointer/keyboard navigation is exercised above. Switch the same
        // React controls directly here so scroll animations do not dominate the layout matrix.
        await studio
          .locator(".pet-tabs")
          .getByRole("button", { name: label, exact: true })
          .evaluate((button) => button.click());
        await page.waitForFunction(
          (label) =>
            document.querySelector('.pet-tabs button[aria-pressed="true"]')
              ?.textContent === label,
          label,
        );
        await page.waitForTimeout(150);
        const issues = await studio.evaluate((root) => {
          const width = document.documentElement.clientWidth;
          const bad = [...root.querySelectorAll("button,input,select,summary")]
            .filter((e) => {
              if (!e.getClientRects().length) return false;
              const r = e.getBoundingClientRect();
              // Primary buttons have a deliberately offscreen ::after shimmer.
              // Measure real button content, not decorative pseudo-element scrollWidth.
              let clipped = e.scrollWidth > e.clientWidth + 2;
              if (e.matches("button")) {
                const range = document.createRange();
                range.selectNodeContents(e);
                const content = range.getBoundingClientRect();
                clipped =
                  content.width > 0 &&
                  (content.left < r.left - 2 || content.right > r.right + 2);
              }
              return (
                r.width > 0 && (r.left < -1 || r.right > width + 1 || clipped)
              );
            })
            .map((e) => ({
              text: e.textContent.trim().slice(0, 60),
              left: e.getBoundingClientRect().left,
              right: e.getBoundingClientRect().right,
              client: e.clientWidth,
              scroll: e.scrollWidth,
            }));
          return {
            overflow: document.documentElement.scrollWidth > width + 1,
            bad,
          };
        });
        assert(!issues.overflow, `${theme}/${width}/${label} page overflow`);
        assert.deepEqual(
          issues.bad,
          [],
          `${theme}/${width}/${label} clipped controls`,
        );
        if (
          capture &&
          ["dark", "light"].includes(theme) &&
          [390, 1440].includes(width) &&
          ["Забота", "Кошелёк"].includes(label)
        ) {
          await studio.evaluate(
            (root, wallet) => {
              document.activeElement?.blur();
              const target = wallet
                ? root.querySelector(".pet-workspace-desk")
                : root;
              window.scrollTo({
                top: target.getBoundingClientRect().top + window.scrollY - 160,
                behavior: "instant",
              });
            },
            width === 390 && label === "Кошелёк",
          );
          await page.screenshot({
            path: `${shots}/${theme}-${width}-${label === "Забота" ? "care" : "wallet"}.png`,
          });
        }
      }
    }
  }
  assert.equal(
    posts.length,
    beforeBrowse,
    "Browsing and resizing never spend, adopt, equip, or claim",
  );
  assert.equal((await snapshot()).balance, 381);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from mg_watches where user_id=$1",
        [me.id],
      )
    ).rows[0].n,
    0,
  );
  assert.equal((await guest.request.get(base + "/api/pet")).status(), 401);
  assert.equal(
    (await guest.request.get(base + "/api/pet?history=1")).status(),
    401,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS cinema pet: load/mutation/history recovery; explicit adoption; daily care/level/funds gates; projector collection; buy/equip/reset; expected-level upgrade; goal purchase; cursor history and filters; public-card privacy; 5 themes ×8 widths ×5 desks; no browsing mutations or watches.",
  );
  await context.close();
  await guest.close();
} finally {
  await browser.close();
  for (const table of [
    "mg_popcorn_ledger",
    "mg_cinema_pets",
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
  await db.query("delete from mg_users where id=any($1::int[])", [users]);
  await db.end();
}
