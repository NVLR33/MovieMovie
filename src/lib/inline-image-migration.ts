import { createHash } from 'node:crypto';
import { IMAGE_EXTENSIONS, MAX_IMAGE_BYTES, validImageBytes } from './image-storage';

export function decodeInlineImage(original: string) {
  if (original.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 100) throw new Error('Oversize inline image');
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(original);
  if (!match) throw new Error('Unsupported inline format');
  const bytes = Buffer.from(match[2], 'base64');
  if (!validImageBytes(bytes, match[1]) || bytes.toString('base64').replace(/=+$/,'') !== match[2].replace(/[\r\n]/g,'').replace(/=+$/,'')) throw new Error('Invalid image');
  return { bytes, type: match[1], extension: IMAGE_EXTENSIONS[match[1]], hash: createHash('sha256').update(bytes).digest('hex') };
}
/** Upload first; the caller must compare-and-swap the exact original in the DB. */
export async function transferInlineImage(original: string, prefix: string, upload: (path: string, bytes: Buffer, type: string) => Promise<string>, replace: (url: string, expected: string) => Promise<boolean>) {
  const image = decodeInlineImage(original);
  const path = `${prefix}-${image.hash}.${image.extension}`;
  const url = await upload(path, image.bytes, image.type);
  if (!url.startsWith('https://') && !url.startsWith('http://')) throw new Error('Storage returned an invalid URL');
  return replace(url, original);
}
