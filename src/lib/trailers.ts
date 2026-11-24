import { playerEmbedUrl } from './player-url';
export const MAX_TRAILER_BYTES = 40 * 1024 * 1024;
export const TRAILER_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};
export type TrailerSource = {
  kind: 'video' | 'embed';
  url: string;
  hover: boolean;
};
export function trailerSource(value: unknown): TrailerSource | null {
  if (typeof value !== 'string' || !value || value.length > 4096) return null;
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      /^(localhost|127\.|0\.)/.test(url.hostname) ||
      url.hostname.includes(':')
    )
      return null;
    if (/\.(mp4|webm)$/i.test(url.pathname))
      return { kind: 'video', url: url.href, hover: true };
    const embed = playerEmbedUrl(url.href);
    if (embed)
      return {
        kind: 'embed',
        url: embed,
        hover: new URL(embed).hostname === 'www.youtube-nocookie.com',
      };
  } catch {
    /* Invalid references never become video/iframe URLs. */
  }
  return null;
}
export function trailerUrl(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  const source = trailerSource(value);
  if (!source)
    throw new Error(
      'Трейлер: укажи HTTPS-ссылку на MP4/WebM, YouTube, Rutube или embed-ссылку VK Видео',
    );
  return source.url;
}
export function trailerPreviewUrl(source: TrailerSource): string {
  if (source.kind === 'video') return source.url;
  const url = new URL(source.url);
  url.searchParams.set('autoplay', '1');
  url.searchParams.set('mute', '1');
  url.searchParams.set('controls', '0');
  url.searchParams.set('playsinline', '1');
  url.searchParams.set('rel', '0');
  return url.href;
}
export function materialTone(film: {
  rating: number;
  ratingCount: number;
}): 'unrated' | 'gold' | 'teal' | 'blue' | 'red' {
  if (!film.ratingCount || !Number.isFinite(film.rating)) return 'unrated';
  return film.rating >= 8.5
    ? 'gold'
    : film.rating >= 7
      ? 'teal'
      : film.rating >= 5
        ? 'blue'
        : 'red';
}
export function validTrailerHeader(bytes: Uint8Array, type: string): boolean {
  return type === 'video/mp4'
    ? bytes.length >= 12 &&
        [102, 116, 121, 112].every((n, i) => bytes[4 + i] === n)
    : type === 'video/webm' &&
        [26, 69, 223, 163].every((n, i) => bytes[i] === n);
}
