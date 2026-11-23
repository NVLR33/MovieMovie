import { extractPalette, type AmbientPalette } from './ambient-palette';
const cache = new Map<
  string,
  { palette: AmbientPalette | null; expires: number }
>();
const pending = new Map<string, Promise<AmbientPalette | null>>();
const LIMIT = 64;
export function ambientImageSource(
  source: string | null | undefined,
): string | null {
  if (!source || source.length > 4096 || /[\u0000-\u0020\\]/.test(source))
    return null;
  if (/^\/(?!\/)/.test(source)) return source;
  try {
    const url = new URL(source);
    return ['https:', 'http:'].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
/** Browser-only, anonymous image read. No proxy endpoint, arbitrary server fetch or SSRF. */
export function imagePalette(source: string): Promise<AmbientPalette | null> {
  if (!ambientImageSource(source)) return Promise.resolve(null);
  const stored = cache.get(source);
  if (stored && stored.expires > Date.now()) {
    cache.delete(source);
    cache.set(source, stored);
    return Promise.resolve(stored.palette);
  }
  const active = pending.get(source);
  if (active) return active;
  if (pending.size >= 4) return Promise.resolve(null); // Bound fast-navigation image work.
  const promise = new Promise<AmbientPalette | null>((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (palette: AmbientPalette | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      cache.delete(source);
      cache.set(source, {
        palette,
        expires: Date.now() + (palette ? 30 * 60_000 : 60_000),
      });
      while (cache.size > LIMIT) cache.delete(cache.keys().next().value!);
      resolve(palette);
    };
    const timer = setTimeout(() => {
      finish(null);
      image.src = '';
    }, 3500);
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.decoding = 'async';
    image.onload = () => {
      try {
        if (
          !image.naturalWidth ||
          !image.naturalHeight ||
          image.naturalWidth * image.naturalHeight > 20_000_000
        )
          return finish(null);
        const canvas = document.createElement('canvas');
        canvas.width = 40;
        canvas.height = 56;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return finish(null);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        finish(
          extractPalette(
            context.getImageData(0, 0, canvas.width, canvas.height).data,
          ),
        );
      } catch {
        finish(null);
      } // CORS / tainted canvas / disabled canvas / memory pressure.
    };
    image.onerror = () => finish(null);
    image.src = source;
  }).finally(() => pending.delete(source));
  pending.set(source, promise);
  return promise;
}
