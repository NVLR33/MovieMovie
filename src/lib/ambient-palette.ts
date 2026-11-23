export type RGB = readonly [number, number, number];
export type AmbientPalette = { primary: RGB; secondary: RGB; tertiary: RGB };
const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
export const rgb = (color: RGB) => `rgb(${color.map(clamp).join(', ')})`;
export const mix = (a: RGB, b: RGB, weight: number): RGB =>
  a.map((value, index) =>
    clamp(value * (1 - weight) + b[index] * weight),
  ) as unknown as RGB;
export function luminance(color: RGB) {
  const [r, g, b] = color.map((value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: RGB, b: RGB) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const distance = (a: RGB, b: RGB) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Small, deterministic histogram. No DOM/dependencies; bounded by the supplied sample. */
export function extractPalette(
  pixels: ArrayLike<number>,
): AmbientPalette | null {
  const histogram = new Map<number, { count: number; sum: number[] }>();
  let count = 0;
  const average = [0, 0, 0];
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    if (pixels[index + 3] < 160) continue;
    const color: RGB = [pixels[index], pixels[index + 1], pixels[index + 2]];
    count++;
    color.forEach((value, i) => (average[i] += value));
    const max = Math.max(...color),
      min = Math.min(...color);
    // Ignore poster lettering, black bars and white margins when selecting hues.
    if (max < 28 || min > 235 || max - min < 18) continue;
    const key =
      ((color[0] >> 5) << 6) | ((color[1] >> 5) << 3) | (color[2] >> 5);
    const bucket = histogram.get(key) || { count: 0, sum: [0, 0, 0] };
    bucket.count++;
    color.forEach((value, i) => (bucket.sum[i] += value));
    histogram.set(key, bucket);
  }
  if (!count) return null;
  const candidates = [...histogram.values()]
    .filter((bucket) => bucket.count >= Math.max(2, count * 0.006))
    .map((bucket) => {
      const color = bucket.sum.map((value) =>
        clamp(value / bucket.count),
      ) as unknown as RGB;
      const saturation = (Math.max(...color) - Math.min(...color)) / 255;
      return { color, score: bucket.count * (0.5 + saturation) };
    })
    .sort((a, b) => b.score - a.score);
  const selected: RGB[] = [];
  for (const { color } of candidates) {
    if (selected.every((previous) => distance(previous, color) >= 75))
      selected.push(color);
    if (selected.length === 3) break;
  }
  const primary =
    selected[0] ||
    (average.map((value) => clamp(value / count)) as unknown as RGB);
  // Monochrome artwork stays monochrome: do not invent a complementary hue.
  return {
    primary,
    secondary: selected[1] || mix(primary, [128, 128, 128], 0.25),
    tertiary: selected[2] || mix(primary, [255, 255, 255], 0.2),
  };
}
function accessibleAccent(
  color: RGB,
  backgrounds: RGB[],
  foreground: RGB,
  light: boolean,
): RGB {
  const target: RGB = light ? [0, 0, 0] : [255, 255, 255];
  for (let step = 0; step <= 100; step++) {
    const adjusted = mix(color, target, step / 100);
    if (
      backgrounds.every(
        (background) => contrast(adjusted, background) >= 4.5,
      ) &&
      contrast(adjusted, foreground) >= 4.5
    )
      return adjusted;
  }
  return target;
}
/** All text/solid-action pairs are >= WCAG AA. Status/rating colors are untouched. */
export function paletteTokens(
  palette: AmbientPalette,
  light: boolean,
): Record<string, string> {
  const base: RGB = light ? [250, 249, 252] : [6, 8, 14];
  const background = mix(palette.primary, base, light ? 0.97 : 0.93);
  const surface = mix(
    palette.primary,
    light ? [255, 255, 255] : [14, 17, 25],
    0.94,
  );
  const surface2 = mix(
    palette.secondary,
    light ? [245, 245, 250] : [22, 25, 35],
    0.94,
  );
  const foreground: RGB = light ? [24, 25, 36] : [244, 243, 249];
  const onAccent: RGB = light ? [255, 255, 255] : [8, 10, 16];
  const surface3 = mix(
    palette.tertiary,
    light ? [236, 237, 244] : [30, 34, 46],
    0.95,
  );
  const backgrounds = [background, surface, surface2, surface3];
  const accent = accessibleAccent(
    palette.primary,
    backgrounds,
    onAccent,
    light,
  );
  const accent2 = accessibleAccent(
    palette.secondary,
    backgrounds,
    onAccent,
    light,
  );
  return {
    '--ambient-primary': rgb(palette.primary),
    '--ambient-secondary': rgb(palette.secondary),
    '--ambient-tertiary': rgb(palette.tertiary),
    '--ambient-bg': rgb(background),
    '--ambient-sidebar': rgb(mix(palette.secondary, base, 0.95)),
    '--ambient-surface': rgb(surface),
    '--ambient-surface2': rgb(surface2),
    '--ambient-surface3': rgb(surface3),
    '--ambient-accent': rgb(accent),
    '--ambient-accent2': rgb(accent2),
    '--ambient-on-accent': rgb(onAccent),
    '--ambient-text': rgb(foreground),
    '--ambient-muted': rgb(light ? [80, 83, 100] : [178, 181, 195]),
    '--ambient-subtle': rgb(light ? [98, 101, 118] : [147, 151, 168]),
    '--ambient-glow': `rgba(${accent.join(', ')}, ${light ? 0.16 : 0.24})`,
  };
}
