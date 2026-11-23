import assert from 'node:assert/strict';
import { test } from 'node:test';
import { oauthSiteOrigin } from '../src/lib/auth-validation';
import {
  AUTH_MESSAGES,
  authErrorMessage,
  databaseErrorCode,
  isAuthSchemaError,
} from '../src/lib/auth-errors';

test('OAuth site origin is explicit, normalized and uses server config over stale public config', () => {
  assert.equal(oauthSiteOrigin({}), 'https://moviemovie.ru');
  assert.equal(
    oauthSiteOrigin({
      SITE_URL: ' https://moviemovie.ru/ ',
      NEXT_PUBLIC_SITE_URL: 'https://old.test',
    }),
    'https://moviemovie.ru',
  );
  assert.equal(
    oauthSiteOrigin({ NEXT_PUBLIC_SITE_URL: 'https://www.moviemovie.ru' }),
    'https://www.moviemovie.ru',
  );
  assert.equal(
    oauthSiteOrigin({
      NODE_ENV: 'development',
      SITE_URL: 'http://localhost:3000',
    }),
    'http://localhost:3000',
  );
  assert.equal(
    oauthSiteOrigin({ NODE_ENV: 'test', SITE_URL: 'http://127.0.0.1:3000' }),
    'http://127.0.0.1:3000',
  );
});
test('OAuth site config cannot become an insecure or malformed redirect', () => {
  for (const SITE_URL of [
    'javascript:alert(1)',
    'ftp://site.test',
    'http://site.test',
    'https://user:password@site.test',
    'https://site.test/path',
    'https://site.test/?a=1',
    'https://site.test/#x',
    'not-a-url',
    'http://localhost:3000',
  ]) {
    assert.throws(
      () => oauthSiteOrigin({ NODE_ENV: 'production', SITE_URL }),
      SITE_URL,
    );
  }
});
test('Public error text is allowlisted, including prototype names from URL parameters', () => {
  assert.equal(authErrorMessage('schema'), AUTH_MESSAGES.schema);
  assert.equal(authErrorMessage('state'), AUTH_MESSAGES.state);
  for (const value of [
    null,
    '',
    'constructor',
    '__proto__',
    'toString',
    '<script>alert(1)</script>',
  ])
    assert.equal(authErrorMessage(value), AUTH_MESSAGES.failed);
});
test('Nested DB errors expose only a safe SQLSTATE and tolerate cycles', () => {
  assert.equal(
    databaseErrorCode({
      cause: { code: '42703', query: 'PRIVATE', params: ['PRIVATE'] },
    }),
    '42703',
  );
  assert.equal(isAuthSchemaError({ cause: { code: '42703' } }), true);
  assert.equal(isAuthSchemaError({ cause: { code: '42P01' } }), true);
  assert.equal(isAuthSchemaError({ code: '23505' }), false);
  assert.equal(databaseErrorCode({ code: 'postgresql://private' }), undefined);
  assert.equal(databaseErrorCode(null), undefined);
  const cycle: { cause?: unknown } = {};
  cycle.cause = cycle;
  assert.equal(databaseErrorCode(cycle), undefined);
});
