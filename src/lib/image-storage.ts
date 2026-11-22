export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const IMAGE_EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
/** No data/blob/javascript URLs or credential-bearing URLs can enter database image columns. */
export function imageUrl(value: unknown, required = false): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw && !required) return '';
  if (!raw || raw.length > 4096 || /[\u0000-\u0020\\]/.test(raw)) throw new Error('Укажите URL изображения или загрузите файл в хранилище');
  if (/^\/(?!\/)/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error();
    return url.href;
  } catch { throw new Error('Изображения сохраняются только как HTTP(S) URL. Base64 не поддерживается — загрузите файл.'); }
}
export function validImageBytes(bytes: Uint8Array, type: string): boolean {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return false;
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === 'image/png') return [137,80,78,71,13,10,26,10].every((n, i) => bytes[i] === n);
  if (type === 'image/webp') return bytes.length >= 12 && [82,73,70,70].every((n,i) => bytes[i] === n) && [87,69,66,80].every((n,i) => bytes[8+i] === n);
  return false;
}
