// Reproducible derivatives of the supplied PNG. No tracing, font substitution or AI redrawing.
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
const source = "public/brand/moviemovie-logo-full.png";
// Navigation keeps the original letters and nearby glow, trimming only the tall glow tails.
const wordmark = await sharp(source)
  .extract({ left: 160, top: 280, width: 1240, height: 460 })
  .png({ compressionLevel: 9 })
  .toBuffer();
await writeFile("public/brand/moviemovie-logo.png", wordmark);
// Two stacked M glyphs taken from the same artwork are legible at favicon sizes.
const mark = await sharp(source)
  .extract({ left: 194, top: 328, width: 320, height: 364 })
  .png()
  .toBuffer();
async function icon(size) {
  return sharp(mark)
    .resize(size - 8, size - 8, { fit: "contain", background: "#10121a" })
    .extend({ top: 4, bottom: 4, left: 4, right: 4, background: "#10121a" })
    .flatten({ background: "#10121a" })
    .ensureAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
}
await writeFile("src/app/icon.png", await icon(192));
await writeFile("src/app/apple-icon.png", await icon(180));
const sizes = [16, 32, 48],
  images = await Promise.all(sizes.map(icon));
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
for (let i = 0; i < images.length; i++) {
  const at = 6 + i * 16;
  header[at] = sizes[i];
  header[at + 1] = sizes[i];
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(images[i].length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += images[i].length;
}
await writeFile("src/app/favicon.ico", Buffer.concat([header, ...images]));
await sharp(source)
  .resize(1200, 630, { fit: "contain", background: "#10121a" })
  .flatten({ background: "#10121a" })
  .png({ compressionLevel: 9 })
  .toFile("public/brand/moviemovie-social.png");
console.log(
  "Generated navigation logo, favicon, app/apple icons and social preview from the supplied moviemovie artwork.",
);
