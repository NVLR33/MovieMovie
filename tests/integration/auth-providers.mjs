// Actual OAuth/auth/session implementations + disposable PGlite, mocked provider HTTP
// and Next request-cookie context only. No live provider, credentials or remote DB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, createHmac } from 'node:crypto';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { NextRequest } from 'next/server.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(root);
const built = await build({
  stdin: {
    contents: `export { GET as oauth } from './src/app/api/oauth/[provider]/route';export { POST as auth } from './src/app/api/auth/route';export {getUser,setSession}from'./src/lib/auth';`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  plugins: [
    {
      name: 'isolated',
      setup(b) {
        b.onResolve({ filter: /^@\/db$/ }, () => ({
          path: 'db',
          namespace: 'fixture',
        }));
        b.onResolve({ filter: /^next\/headers$/ }, () => ({
          path: 'cookies',
          namespace: 'fixture',
        }));
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, (a) => ({
          contents:
            a.path === 'db'
              ? 'export const db=globalThis.__db;'
              : 'export const cookies=async()=>globalThis.__cookies;',
          loader: 'js',
        }));
      },
    },
  ],
});
const pg = new PGlite(),
  originalFetch = globalThis.fetch;
const keys = [
  'SITE_URL',
  'NEXT_PUBLIC_SITE_URL',
  'YANDEX_CLIENT_ID',
  'YANDEX_CLIENT_SECRET',
  'SESSION_SECRET',
  'NODE_ENV',
  'TELEGRAM_BOT_TOKEN',
];
const savedEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
let checks = 0;
try {
  await pg.exec(
    fs.readFileSync(
      'tests/integration/fixtures/pre-economy-schema.sql',
      'utf8',
    ),
  );
  await pg.exec(fs.readFileSync('scripts/supabase/01-upgrade.sql', 'utf8'));
  const authCheck = fs.readFileSync(
    'scripts/supabase/04-auth-check.sql',
    'utf8',
  );
  assert((await pg.query(authCheck)).rows.every((row) => row.result === 'OK'));
  globalThis.__db = drizzle(pg);
  const cookieValues = new Map();
  globalThis.__cookies = {
    get: (name) => cookieValues.get(name),
    set: (name, value, options) => cookieValues.set(name, { value, options }),
  };
  const file = resolve(root, 'tests/integration/auth-fixture.cjs'),
    mod = new Module(file);
  mod.paths = Module._nodeModulePaths(dirname(file));
  mod._compile(built.outputFiles[0].text, file);
  const r = mod.exports;
  Object.assign(process.env, {
    SITE_URL: 'https://moviemovie.test',
    NEXT_PUBLIC_SITE_URL: 'https://stale.test',
    YANDEX_CLIENT_ID: 'fake-client-id',
    YANDEX_CLIENT_SECRET: 'fake-client-secret',
    SESSION_SECRET: 'test-only-session-secret-with-more-than-32-chars',
    NODE_ENV: 'production',
    TELEGRAM_BOT_TOKEN: 'fake-bot-token',
  });
  let provider = {
      id: '123456',
      default_email: 'User@Example.test',
      display_name: 'Киноман',
      default_avatar_id: '12345/avatar',
    },
    tokenStatus = 200,
    infoStatus = 200,
    tokenBody = { access_token: 'fake-access-token' },
    networkFailure = false;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    assert.equal(init.cache, 'no-store');
    assert(init.signal);
    if (networkFailure) throw new TypeError('network failed with PRIVATE data');
    if (url === 'https://oauth.yandex.ru/token')
      return Response.json(tokenBody, { status: tokenStatus });
    if (url === 'https://login.yandex.ru/info?format=json')
      return Response.json(provider, { status: infoStatus });
    throw new Error('Unexpected external URL');
  };
  const oauth = async ({
    origin = 'https://moviemovie.test',
    query = '',
    cookie = '',
    host,
    provider = 'yandex',
  } = {}) => {
    const response = await r.oauth(
      new NextRequest(`${origin}/api/oauth/${provider}${query}`, {
        headers: { ...(cookie ? { cookie } : {}), ...(host ? { host } : {}) },
      }),
      { params: Promise.resolve({ provider }) },
    );
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    checks++;
    return response;
  };
  const reason = (response) =>
    new URL(response.headers.get('location')).searchParams.get('auth');
  let initial = await oauth();
  const authorize = new URL(initial.headers.get('location')),
    state = authorize.searchParams.get('state');
  assert.equal(authorize.origin, 'https://oauth.yandex.ru');
  assert.equal(
    authorize.searchParams.get('redirect_uri'),
    'https://moviemovie.test/api/oauth/yandex',
  );
  assert(state.length >= 40);
  assert(initial.headers.get('set-cookie').includes('Secure'));
  assert(initial.headers.get('set-cookie').includes('HttpOnly'));
  assert(initial.headers.get('set-cookie').includes('SameSite=lax'));
  // www/preview aliases are redirected to canonical host before any cookie is set.
  for (const origin of [
    'https://www.moviemovie.test',
    'https://preview.test',
  ]) {
    const response = await oauth({ origin });
    assert.equal(
      response.headers.get('location'),
      'https://moviemovie.test/api/oauth/yandex',
    );
    assert.equal(response.headers.get('set-cookie'), null);
  }
  // Real reverse proxies can present an internal Next URL but an external Host header.
  const proxied = await oauth({
    origin: 'http://localhost:3000',
    host: 'moviemovie.test',
  });
  assert.equal(
    new URL(proxied.headers.get('location')).host,
    'oauth.yandex.ru',
  );
  const cookie = `mg_oauth_yandex=${state}`,
    query = `?code=test-code&state=${state}`;
  assert.equal(reason(await oauth({ query })), 'state');
  assert.equal(
    reason(await oauth({ query: '?code=test-code&state=forged', cookie })),
    'state',
  );
  assert.equal(
    reason(
      await oauth({ origin: 'https://www.moviemovie.test', query, cookie }),
    ),
    'state',
  );
  assert.equal(calls.length, 0);
  assert.equal(
    reason(
      await oauth({ query: `?error=access_denied&state=${state}`, cookie }),
    ),
    'cancelled',
  );
  assert.equal(reason(await oauth({ query: '?error=access_denied' })), 'state');
  assert.equal(
    reason(await oauth({ query: `?code=&state=${state}`, cookie })),
    'token',
  );
  const successful = await oauth({ query, cookie });
  assert.equal(successful.headers.get('location'), 'https://moviemovie.test/');
  assert(successful.headers.get('set-cookie').includes('Max-Age=0'));
  const account = (
    await pg.query("select * from mg_users where email='user@example.test'")
  ).rows[0];
  assert(account);
  assert.equal(account.provider, 'yandex');
  assert.equal(
    account.avatar,
    'https://avatars.yandex.net/get-yapic/12345/avatar/islands-200',
  );
  const session = cookieValues.get('mg_session');
  assert(session);
  assert(session.options.httpOnly);
  assert(session.options.secure);
  assert.equal((await r.getUser()).id, account.id);
  checks++;
  const submitted = new URLSearchParams(calls[0].init.body);
  assert.equal(
    submitted.get('redirect_uri'),
    authorize.searchParams.get('redirect_uri'),
  );
  assert.equal(submitted.get('code'), 'test-code');
  assert.equal(calls[1].init.headers.Authorization, 'OAuth fake-access-token');
  await oauth({ query, cookie });
  assert.equal(
    (await pg.query('select count(*)::int n from mg_users')).rows[0].n,
    1,
  );
  // Existing email-based users keep ID, role, editor flag and password.
  await pg.exec(
    "insert into mg_users(email,username,provider,role,is_editor,password_hash)values('linked@example.test','Existing','email','moderator',true,'unchanged-hash')",
  );
  provider = {
    ...provider,
    id: '7654321',
    default_email: 'linked@example.test',
  };
  await oauth({ query, cookie });
  const linked = await r.getUser();
  assert.equal(linked.username, 'Existing');
  assert.equal(linked.role, 'moderator');
  assert.equal(linked.isEditor, true);
  assert.equal(linked.passwordHash, 'unchanged-hash');
  // Bad/expired codes, upstream downtime and malformed responses are distinct.
  tokenStatus = 400;
  assert.equal(reason(await oauth({ query, cookie })), 'token');
  tokenStatus = 503;
  assert.equal(reason(await oauth({ query, cookie })), 'unavailable');
  tokenStatus = 200;
  tokenBody = { error: 'invalid_grant', description: 'PRIVATE' };
  assert.equal(reason(await oauth({ query, cookie })), 'token');
  tokenBody = { access_token: 'fake-access-token' };
  infoStatus = 401;
  assert.equal(reason(await oauth({ query, cookie })), 'profile');
  infoStatus = 503;
  assert.equal(reason(await oauth({ query, cookie })), 'unavailable');
  infoStatus = 200;
  networkFailure = true;
  assert.equal(reason(await oauth({ query, cookie })), 'unavailable');
  networkFailure = false;
  provider = { ...provider, default_email: undefined };
  assert.equal(reason(await oauth({ query, cookie })), 'profile');
  provider = { ...provider, default_email: 'linked@example.test' };
  await pg.query('update mg_users set is_suspended=true where id=$1', [
    linked.id,
  ]);
  assert.equal(reason(await oauth({ query, cookie })), 'blocked');
  await pg.query('update mg_users set is_suspended=false where id=$1', [
    linked.id,
  ]);
  const oldSession = cookieValues.get('mg_session');
  await pg.query(
    'update mg_users set session_version=session_version+1 where id=$1',
    [linked.id],
  );
  assert.equal(await r.getUser(), null);
  checks++;
  await oauth({ query, cookie });
  assert((await r.getUser()).id === linked.id);
  assert.notEqual(cookieValues.get('mg_session').value, oldSession.value);
  checks++;
  process.env.SESSION_SECRET = 'short';
  assert.equal(reason(await oauth({ query, cookie })), 'session');
  process.env.SESSION_SECRET =
    'test-only-session-secret-with-more-than-32-chars';
  const post = async (body, status = 200) => {
    const response = await r.auth(
      new NextRequest('https://moviemovie.test/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
    const result = await response.json();
    assert.equal(response.status, status, JSON.stringify(result));
    checks++;
    return result;
  };
  await pg.exec(
    'alter table mg_users rename column is_editor to is_editor_missing',
  );
  assert.equal(
    (await pg.query(authCheck)).rows.find(
      (row) => row.check_name === 'auth_column:is_editor',
    ).result,
    'MISSING',
  );
  assert.equal(reason(await oauth({ query, cookie })), 'schema');
  const schema = await post(
    {
      action: 'login',
      email: 'linked@example.test',
      password: 'some-password',
    },
    503,
  );
  assert(schema.error.includes('SQL-миграции'));
  assert(!/SELECT|is_editor_missing|password_hash/.test(schema.error));
  await pg.exec(
    'alter table mg_users rename column is_editor_missing to is_editor',
  );
  const password = 'valid-password-123';
  const registered = await post({
    action: 'register',
    email: 'password@example.test',
    password,
    username: 'PasswordUser',
  });
  assert(!('sessionVersion' in registered.user));
  assert(!('passwordHash' in registered.user));
  await post({ action: 'login', email: 'password@example.test', password });
  assert.equal((await r.getUser()).id, registered.user.id);
  checks++;
  const telegram = {
    id: 889900,
    auth_date: Math.floor(Date.now() / 1000),
    first_name: 'Telegram',
  };
  const checkString = Object.entries(telegram)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  telegram.hash = createHmac(
    'sha256',
    createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest(),
  )
    .update(checkString)
    .digest('hex');
  const tg = await post({ action: 'telegram', telegramData: telegram });
  assert.equal((await r.getUser()).id, tg.user.id);
  checks++;
  await post(
    { action: 'telegram', telegramData: { ...telegram, hash: '0'.repeat(64) } },
    401,
  );
  delete process.env.YANDEX_CLIENT_SECRET;
  assert.equal(reason(await oauth()), 'config');
  process.env.YANDEX_CLIENT_SECRET = 'fake-client-secret';
  assert.equal(reason(await oauth({ provider: 'unknown' })), 'provider');
  process.env.SITE_URL = 'javascript:alert(1)';
  assert.equal(reason(await oauth()), 'config');
  console.log(
    `Passed ${checks} actual OAuth/auth/session checks: canonical host before state cookie, proxy Host handling, CSRF failures/cancel, full Yandex create/repeat/link flows, token/profile/network errors, blocked accounts, session revocation + signed cookies, missing migrations/config, credentials and signed Telegram.`,
  );
} finally {
  globalThis.fetch = originalFetch;
  delete globalThis.__db;
  delete globalThis.__cookies;
  for (const key of keys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  await pg.close();
}
