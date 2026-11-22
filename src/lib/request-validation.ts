import { NextResponse } from 'next/server';
export const MAX_DATABASE_ID = 2147483647;
export class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function isDatabaseId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_DATABASE_ID;
}
export function databaseId(value: unknown, label = 'ID') {
  const id = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!isDatabaseId(id)) throw new RequestError(`Неверный ${label}`);
  return id;
}
export function requireSameOrigin(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') throw new RequestError('Запрос с другого сайта запрещён', 403);
  const origin = request.headers.get('origin');
  if (!origin) return; // CLI/mobile clients may omit Origin; session checks still apply.
  try {
    if (![new URL(request.url).host, request.headers.get('host')].includes(new URL(origin).host)) throw new Error();
  } catch { throw new RequestError('Запрос с другого сайта запрещён', 403); }
}
// Keep the JSON boundary dynamic; each route validates its action-specific fields.
export async function readJsonObject(request: Request) {
  requireSameOrigin(request);
  const maxBytes = 65536;
  if (Number(request.headers.get('content-length')) > maxBytes) throw new RequestError('Слишком большой запрос', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError('Некорректный JSON');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) { await reader.cancel(); throw new RequestError('Слишком большой запрос', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new RequestError('Некорректный JSON'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RequestError('Ожидается JSON-объект');
  return body;
}
export function requestFailure(error: unknown, fallback = 'Не удалось обработать запрос') {
  if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('[API]', error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
export function isDatabaseFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return 'query' in error || 'code' in error || ('cause' in error && isDatabaseFailure(error.cause));
}
