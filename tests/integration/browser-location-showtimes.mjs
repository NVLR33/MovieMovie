// Actual production app; deterministic geocoder/showtime responses are intercepted.
// No real GPS, external provider traffic, database writes or private location data.
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
    window.geoCalls = 0;
    window.geoMode = "ok";
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(success, error) {
          window.geoCalls++;
          if (window.geoMode === "denied") return error({ code: 1 });
          if (window.geoMode === "timeout") return error({ code: 3 });
          success({
            coords: {
              latitude: 57.819324,
              longitude: 28.334763,
              accuracy: 100,
            },
          });
        },
      },
    });
  });
  const page = await context.newPage(),
    errors = [],
    geoRequests = [],
    external = [];
  page.on("pageerror", (error) => errors.push(error.message));
  context.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(base).origin)
      external.push(request.url());
  });
  let mode = "ready",
    geoMode = "ok";
  await context.route("**/api/location", async (route) => {
    geoRequests.push(route.request().postDataJSON());
    if (geoMode === "error")
      return route.fulfill({
        status: 502,
        json: { error: "Геокодер временно недоступен." },
      });
    return route.fulfill({
      json: {
        city: "Псков",
        region: "Псковская область",
        country: "Россия",
        source: "OpenStreetMap",
      },
    });
  });
  const showing = (id, movie, cinema, hour) => ({
    id,
    movieId: movie === "Фильм один" ? 11 : 12,
    movie,
    cinema,
    address: "Улица, 10",
    startsAt: `2026-11-22T${hour}:00:00.000Z`,
    price: "от 350 ₽",
    format: "3D",
    url: "https://kudago.com/ekb/movie/11/",
  });
  await context.route("**/api/showtimes?*", (route) => {
    const url = new URL(route.request().url()),
      date = url.searchParams.get("date") || "2026-11-22";
    if (mode === "error")
      return route.fulfill({
        status: 502,
        json: { error: "Источник временно недоступен." },
      });
    return route.fulfill({
      json: {
        city: url.searchParams.get("city"),
        date,
        today: "2026-11-22",
        timezone: "Asia/Yekaterinburg",
        source: "KudaGo",
        status: mode === "unsupported" ? "unsupported" : "ready",
        updatedAt: "2026-11-22T10:00:00.000Z",
        truncated: false,
        showings:
          mode === "empty" || mode === "unsupported"
            ? []
            : [
                showing(1, "Фильм один", "Космос", "12"),
                showing(2, "Фильм один", "Космос", "14"),
                showing(3, "Фильм два", "Салют", "13"),
              ],
      },
    });
  });
  const picker = page.getByRole("dialog", { name: "Ваш город", exact: true });
  const openPicker = async () => {
    await page.locator(".header-city-button").click();
    await picker.waitFor();
  };
  const apply = async (city) => {
    await picker.getByLabel("Город", { exact: true }).fill(city);
    await picker
      .getByRole("button", { name: "Применить", exact: true })
      .click();
    await page.getByRole("button", {name:`Город: ${city}`,exact:true}).waitFor();
  };
  const closePicker = async () => {
    await picker
      .getByRole("button", { name: "Закрыть выбор города", exact: true })
      .click();
    await picker.waitFor({ state: "detached" });
  };
  await page.goto(base);
  await page.locator(".header-city-button").waitFor();
  assert.equal(await page.locator(".content .city-cinema").count(), 0);
  assert.equal(await page.evaluate(() => window.geoCalls), 0);
  assert.equal(geoRequests.length, 0);
  await openPicker();
  assert.equal(
    await picker.getByLabel(/Запомнить на этом устройстве/).isChecked(),
    true,
  );
  await apply("Екатеринбург");
  await closePicker();
  await page.reload();
  await page
    .getByRole("button", { name: "Город: Екатеринбург", exact: true })
    .waitFor();
  assert.equal(await page.evaluate(() => window.geoCalls), 0);
  await openPicker();
  await picker
    .getByRole("button", { name: "Определить местоположение", exact: true })
    .click();
  await picker.getByText(/Найден город: Псков/).waitFor();
  assert.deepEqual(geoRequests.at(-1), {
    latitude: 57.82,
    longitude: 28.33,
    accuracy: 100,
  });
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("mg_city_v1")).city,
    ),
    "Екатеринбург",
    "GPS proposal must be confirmed",
  );
  await picker.getByRole("button", { name: "Применить", exact: true }).click();
  await page
    .getByRole("button", { name: "Город: Псков", exact: true })
    .waitFor();
  assert.deepEqual(
    await page.evaluate(() => JSON.parse(localStorage.getItem("mg_city_v1"))),
    { city: "Псков" },
  );
  await page.evaluate(() => (window.geoMode = "denied"));
  await picker
    .getByRole("button", { name: "Определить местоположение", exact: true })
    .click();
  await picker.getByText(/Доступ к геолокации запрещён/).waitFor();
  await page.evaluate(() => (window.geoMode = "timeout"));
  await picker
    .getByRole("button", { name: "Определить местоположение", exact: true })
    .click();
  await picker.getByText(/Не удалось определить местоположение/).waitFor();
  await page.evaluate(() => (window.geoMode = "ok"));
  geoMode = "error";
  await picker
    .getByRole("button", { name: "Определить местоположение", exact: true })
    .click();
  await picker.getByText(/Геокодер временно недоступен/).waitFor();
  geoMode = "ok";
  await apply("Екатеринбург");
  await closePicker();
  await page.locator(".header-showtimes-link").click();
  await page.waitForURL("**/showtimes");
  await page.locator(".showtime-movie").first().waitFor();
  assert.equal(await page.locator(".showtime-movie").count(), 2);
  assert.equal(await page.locator(".showtime-slots a").count(), 3);
  assert.equal(
    await page.locator(".showtime-slots b").first().innerText(),
    "17:00",
  );
  assert.equal(
    await page.getByRole("link", { name: /Искать во внешнем сервисе/ }).count(),
    1,
  );
  await page
    .getByRole("combobox", { name: "Кинотеатр", exact: true })
    .selectOption("Салют");
  assert.equal(await page.locator(".showtime-movie").count(), 1);
  await page
    .getByRole("combobox", { name: "Кинотеатр", exact: true })
    .selectOption("");
  await page
    .getByRole("searchbox", { name: "Поиск по афише", exact: true })
    .fill("Не найдено");
  await page
    .getByRole("heading", { name: "По этим фильтрам ничего нет", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Сбросить фильтры", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Дата сеансов", exact: true })
    .selectOption("2026-11-23");
  await page.locator(".showtime-movie").first().waitFor();
  await mkdir("/tmp/mm-location-screenshots", { recursive: true });
  for (const width of [320, 360, 390, 600, 760, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `page overflow ${width}`,
    );
    await openPicker();
    assert(
      await picker.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      `picker overflow ${width}`,
    );
    for (let n = 0; n < 10; n++) {
      await page.keyboard.press("Tab");
      assert(
        await picker.evaluate((el) => el.contains(document.activeElement)),
      );
    }
    await page.keyboard.press("Escape");
    assert.equal(
      await page
        .locator(".header-city-button")
        .evaluate((el) => el === document.activeElement),
      true,
    );
    if ([390, 1440].includes(width)) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `/tmp/mm-location-screenshots/showtimes-${width}.png`,
        fullPage: true,
      });
    }
  }
  for (const state of ["empty", "unsupported", "error"]) {
    mode = state;
    await page.reload();
    await page.locator(".showtimes-empty").waitFor();
    assert.equal(await page.locator(".showtime-slots a").count(), 0);
    assert.equal(
      await page
        .getByRole("link", { name: /Искать во внешнем сервисе/ })
        .count(),
      1,
    );
  }
  mode = "ready";
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await page.locator(".showtime-movie").first().waitFor();
  const tab = await context.newPage();
  await tab.goto(base);
  await tab
    .getByRole("button", { name: "Город: Екатеринбург", exact: true })
    .waitFor();
  await openPicker();
  await picker
    .getByRole("button", { name: "Сбросить город", exact: true })
    .click();
  await tab
    .getByRole("button", { name: "Город: Выбрать город", exact: true })
    .waitFor();
  await closePicker();
  await tab.close();
  assert.equal(
    await page.locator(".showtime-movie").count(),
    0,
    "Clearing location removes the previous city schedule",
  );
  // Restricted storage still permits an in-memory choice, with an explicit persistence warning.
  const restricted = await browser.newContext({
    viewport: { width: 320, height: 900 },
  });
  await restricted.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    Storage.prototype.getItem = () => {
      throw new DOMException("blocked", "SecurityError");
    };
  });
  const rp = await restricted.newPage();
  await rp.goto(base);
  await rp.locator(".header-city-button").click();
  const rd = rp.getByRole("dialog", { name: "Ваш город", exact: true });
  await rd.getByLabel("Город", { exact: true }).fill("Псков");
  await rd.getByRole("button", { name: "Применить", exact: true }).click();
  await rd.getByText(/браузер не разрешает запоминание/).waitFor();
  await rp.getByRole("button", { name: "Город: Псков", exact: true }).waitFor();
  await restricted.close();
  assert.deepEqual(
    external,
    [],
    "No direct provider/geocoder requests from the browser",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: top city entry, no automatic GPS, rounded explicit geolocation/confirmation, persistence/reload/cross-tab clear, denied/timeout/provider failure/manual fallback, eight widths/focus, showtimes grouping/timezone/filter/date/empty/unsupported/error/retry and restricted storage. External responses are fixtures, not a real-provider availability check.",
  );
} finally {
  await browser.close();
}
