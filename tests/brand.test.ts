import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import sharp from "sharp";
import {
  BRAND_NAME,
  BRAND_SOCIAL_IMAGE,
  DEFAULT_SITE_URL,
} from "../src/lib/brand";

test("public branding uses the lowercase name and canonical origin", () => {
  assert.equal(BRAND_NAME, "moviemovie");
  assert.equal(DEFAULT_SITE_URL, "https://moviemovie.ru");
  assert.equal(BRAND_SOCIAL_IMAGE, "/brand/moviemovie-social.png");
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  assert.doesNotMatch(layout, /moviego/i);
  assert.match(layout, /siteName: BRAND_NAME/);
  assert.match(layout, /images: \[BRAND_SOCIAL_IMAGE\]/);
  for (const file of readdirSync("src/components").filter((file) =>
    file.endsWith(".tsx"),
  )) {
    const source = readFileSync(`src/components/${file}`, "utf8");
    assert.doesNotMatch(source, /MovieMovie|MOVIEMOVIE|@moviego\.ru/, file);
  }
  assert.match(
    readFileSync("src/app/globals.css", "utf8"),
    /\.brand-name\s*\{\s*text-transform:\s*none\s*!important/,
  );
});

test("navigation logo is an unretouched crop of the original supplied PNG", async () => {
  const expected = await sharp("public/brand/moviemovie-logo-full.png")
    .extract({ left: 160, top: 280, width: 1240, height: 460 })
    .raw()
    .toBuffer();
  const actual = await sharp("public/brand/moviemovie-logo.png")
    .raw()
    .toBuffer();
  assert.deepEqual(actual, expected);
});

test("browser, Apple and social icons have the expected sizes and real favicon frames", async () => {
  for (const [path, width, height] of [
    ["src/app/icon.png", 192, 192],
    ["src/app/apple-icon.png", 180, 180],
    ["public/brand/moviemovie-social.png", 1200, 630],
  ] as const) {
    const image = await sharp(path).metadata();
    assert.equal(image.width, width, path);
    assert.equal(image.height, height, path);
  }
  const ico = readFileSync("src/app/favicon.ico");
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  for (const [i, size] of [16, 32, 48].entries()) {
    const at = 6 + i * 16,
      length = ico.readUInt32LE(at + 8),
      offset = ico.readUInt32LE(at + 12);
    const frame = await sharp(ico.subarray(offset, offset + length)).metadata();
    assert.equal(frame.width, size);
    assert.equal(frame.height, size);
  }
});
