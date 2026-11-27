// Read-only branding smoke test. Run against a local production build.
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
    (arg) => !["--single-process", "--disable-web-security"].includes(arg),
  ),
  headless: true,
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const shots = process.env.BRAND_SCREENSHOTS || "/tmp/mm-brand-screenshots";
await mkdir(shots, { recursive: true });
try {
  for (const width of [1440, 1024, 760, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto(base, { waitUntil: "networkidle" });
    await page
      .locator(".footer-logo .brand-logo")
      .waitFor({ state: "attached" });
    assert.match(await page.title(), /^moviemovie/);
    assert.equal(
      await page
        .locator('meta[property="og:site_name"]')
        .getAttribute("content"),
      "moviemovie",
    );
    assert.match(
      await page.locator('meta[property="og:image"]').getAttribute("content"),
      /\/brand\/moviemovie-social.png$/,
    );
    for (const selector of [
      width <= 760 ? ".mobile-brand" : ".side-brand",
      ".footer-logo",
    ]) {
      const logo = page.locator(`${selector} .brand-logo`);
      await logo.waitFor({ state: "visible" });
      await logo.evaluate((im) => im.decode());
      const dimensions = await logo.evaluate((im) => ({
        w: im.getBoundingClientRect().width,
        h: im.getBoundingClientRect().height,
        nw: im.naturalWidth,
        nh: im.naturalHeight,
        alt: im.alt,
      }));
      assert.equal(dimensions.alt, "moviemovie");
      assert(
        Math.abs(dimensions.w / dimensions.h - 1240 / 460) < 0.03,
        JSON.stringify(dimensions),
      );
      assert(dimensions.nw > 0 && dimensions.nh > 0);
    }
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `horizontal overflow at ${width}`,
    );
    const wrongCase = await page.evaluate(() => {
      const result = [],
        walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const text = walker.currentNode,
          el = text.parentElement;
        if (
          !el ||
          !el.checkVisibility() ||
          ["SCRIPT", "STYLE"].includes(el.tagName)
        )
          continue;
        if (/moviego|movie-go|MovieMovie|MOVIEMOVIE/.test(text.textContent))
          result.push(text.textContent);
        if (
          text.textContent.includes("moviemovie") &&
          getComputedStyle(el).textTransform === "uppercase"
        )
          result.push(`CSS uppercase: ${text.textContent}`);
      }
      return result;
    });
    assert.deepEqual(wrongCase, [], `brand casing at ${width}`);
    if (width === 1440 || width === 390)
      await page.screenshot({ path: `${shots}/home-${width}.png` });
    await page.evaluate(
      () => (document.documentElement.dataset.theme = "light"),
    );
    await page.screenshot({ path: `${shots}/light-${width}.png` });
  }
  for (const path of [
    "/favicon.ico",
    "/icon.png",
    "/apple-icon.png",
    "/brand/moviemovie-social.png",
  ]) {
    const response = await page.request.get(`${base}${path}`);
    assert.equal(response.status(), 200, path);
    assert((await response.body()).length > 1000, path);
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: original logo geometry, lowercase rendered branding, metadata and icons at 1440/1024/760/390; no runtime errors.",
  );
} finally {
  await browser.close();
}
