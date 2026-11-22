import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSiteRoute, STATIC_SITE_ROUTES } from '../src/lib/site-routes';
import { databaseId, readJsonObject, RequestError, isDatabaseFailure } from '../src/lib/request-validation';
test('all documented page routes resolve and malformed/deep/unknown paths do not fall back to home', () => {
  assert.equal(resolveSiteRoute('/')?.page, 'home');
  for (const route of STATIC_SITE_ROUTES) assert.equal(resolveSiteRoute('/' + route)?.page, route);
  for (const [path, page] of [['/movie/12','movie'],['/user/2','viewuser'],['/compare/3','compare'],['/room/ABC123','room']]) assert.equal(resolveSiteRoute(path)?.page, page);
  for (const path of ['/unknown', '/catalog/extra', '/movie', '/movie/0', '/movie/NaN', '/movie/-1', '/movie/1/extra', '/movie/2147483648', '/user/1e2', '/room/ab', '/room/a b c']) assert.equal(resolveSiteRoute(path), null, path);
});
test('database IDs fit actual PostgreSQL integer columns and reject coercion traps', () => {
  assert.equal(databaseId('2147483647'), 2147483647);
  for (const id of [null, undefined, '', ' ', '1e2', '1.5', 1.5, -1, 0, 2147483648, true, {}, []]) assert.throws(() => databaseId(id), RequestError);
});
test('JSON object body reader rejects malformed, scalar, array and oversized payloads', async () => {
  for (const body of ['null','[]','"text"','1','{']) await assert.rejects(readJsonObject(new Request('https://test.local/api/action',{ method:'POST', body })), RequestError);
  assert.deepEqual(await readJsonObject(new Request('https://test.local/api/action',{ method:'POST', body:'{"action":"watch"}' })), { action:'watch' });
  await assert.rejects(readJsonObject(new Request('https://test.local/api/action',{ method:'POST', body:JSON.stringify({ text:'x'.repeat(65536) }) })), (error: unknown) => error instanceof RequestError && error.status === 413);
});
test('database errors are classified for sanitization, not sent as business validation text', () => {
  assert(isDatabaseFailure({ query:'SELECT secret', cause: { code:'08006' } }));
  assert(isDatabaseFailure({ cause: { code:'23505' } }));
  assert(!isDatabaseFailure(new Error('Напишите комментарий')));
});

test('JSON mutation endpoints reject cross-site requests before parsing', async () => {
  for (const headers of [{ origin:'https://evil.test' }, { 'sec-fetch-site':'cross-site' }] as Record<string,string>[]) {
    await assert.rejects(readJsonObject(new Request('https://test.local/api/action',{ method:'POST', headers, body:'{}' })), (error: unknown) => error instanceof RequestError && error.status === 403);
  }
  assert.deepEqual(await readJsonObject(new Request('https://internal.local/api/action',{ method:'POST',headers:{ host:'preview.e2b.app',origin:'https://preview.e2b.app' },body:'{}' })),{});
});
