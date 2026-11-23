// Actual route implementations, isolated SQL database; no remote credentials or data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { NextRequest } from 'next/server.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(root);
const built = await build({
  stdin: {
    contents: `export {GET as get,POST as post} from './src/app/api/admin/route';export {POST as action} from './src/app/api/action/route';export {GET as data} from './src/app/api/data/route';export {POST as series} from './src/app/api/series/route';export {POST as upload} from './src/app/api/upload/route';`,
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
        b.onResolve({ filter: /^@\/lib\/auth$/ }, () => ({
          path: 'auth',
          namespace: 'fixture',
        }));
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, (a) => ({
          contents:
            a.path === 'db'
              ? 'export const db=globalThis.__db;'
              : `export const getUser=async()=>globalThis.__user;export const publicUser=u=>u;`,
          loader: 'js',
        }));
      },
    },
  ],
});
const pg = new PGlite();
let calls = 0;
try {
  await pg.exec(
    fs.readFileSync(
      'tests/integration/fixtures/pre-economy-schema.sql',
      'utf8',
    ),
  );
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  const bundle = fs.readFileSync('scripts/supabase/01-upgrade.sql', 'utf8');
  await pg.exec(bundle);
  await pg.exec(bundle);
  await pg.exec(
    "INSERT INTO mg_users(id,email,username,role,is_editor)VALUES(1,'admin@test','Admin','admin',false),(2,'mod@test','Mod','moderator',false),(3,'editor@test','Editor','visitor',true),(4,'reader@test','Reader','visitor',false),(5,'second@test','Second','admin',true);",
  );
  const security = (
    await pg.query(
      "SELECT relrowsecurity AS rls, has_table_privilege('anon','mg_admin_audit','SELECT') AS anon_read, has_table_privilege('authenticated','mg_admin_audit','SELECT') AS member_read FROM pg_class WHERE oid='mg_admin_audit'::regclass",
    )
  ).rows[0];
  assert.equal(security.rls, true);
  assert.equal(security.anon_read, false);
  assert.equal(security.member_read, false);
  globalThis.__db = drizzle(pg);
  const file = resolve(root, 'tests/integration/admin-fixture.cjs'),
    mod = new Module(file);
  mod.paths = Module._nodeModulePaths(dirname(file));
  mod._compile(built.outputFiles[0].text, file);
  const routes = mod.exports;
  const actor = async (id) => {
    const u = id
      ? (await pg.query('select * from mg_users where id=$1', [id])).rows[0]
      : null;
    globalThis.__user = u
      ? {
          ...u,
          isEditor: u.is_editor,
          isSuspended: u.is_suspended,
          sessionVersion: u.session_version,
        }
      : null;
  };
  const call = async (
    name,
    { body, query = '', status = 200, headers = {} } = {},
  ) => {
    const response = await routes[name](
      new NextRequest(
        'https://test.local/api/' +
          (name === 'get' || name === 'post' ? 'admin' : name) +
          '?' +
          query,
        {
          method: body === undefined ? 'GET' : 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
      ),
    );
    const result = await response.json();
    assert.equal(response.status, status, JSON.stringify(result));
    assert(!/password_hash|Failed query/.test(JSON.stringify(result)));
    calls++;
    return result;
  };
  const post = (body, status = 200) => call('post', { body, status });
  const action = (body, status = 200) => call('action', { body, status });
  const material = {
    title: 'Editor publication',
    description: 'Description',
    category: 'Сериал',
    genre: 'Драма',
    year: 2020,
    duration: 45,
    poster: '/brand/moviemovie-logo.png',
    country: 'Россия',
  };
  await actor(null);
  await call('get', { status: 401 });
  await post({ command: 'editor', userId: 4, enabled: true }, 401);
  await actor(4);
  await call('get', { status: 403 });
  await post({ command: 'editor', userId: 4, enabled: true }, 403);
  await action({ action: 'movieSave', ...material }, 403);
  await actor(3);
  const overview = await call('get');
  assert.equal(overview.permissions.create, true);
  assert.equal(overview.moderation, null);
  assert.equal(overview.accounts, null);
  for (const section of ['users', 'audit', 'comments'])
    await call('get', { query: 'section=' + section, status: 403 });
  await post({ command: 'featured', ids: [1], enabled: true }, 403);
  await post({ command: 'role', userId: 4, role: 'admin' }, 403);
  const created = await action({
    action: 'movieSave',
    ...material,
    featured: true,
  });
  const id = created.movieId;
  assert(id);
  assert.equal(
    (await pg.query('select featured from mg_movies where id=$1', [id])).rows[0]
      .featured,
    false,
  );
  await action(
    { action: 'movieSave', ...material, id, title: 'Hijacked' },
    403,
  );
  await action({ action: 'movieDelete', id }, 403);
  await action({ action: 'approveSuggestion', id: 1 }, 403);
  await call('series', {
    body: {
      action: 'saveSeason',
      movieId: id,
      number: 1,
      title: 'First',
      episodeCount: 1,
    },
    status: 403,
  });
  // Poster permission is checked before parsing file contents; authorized editors reach file validation.
  const upload = await routes.upload(
    new NextRequest('https://test.local/api/upload', {
      method: 'POST',
      body: new URLSearchParams({ kind: 'poster' }),
    }),
  );
  assert.equal(upload.status, 400);
  calls++;
  await actor(2);
  const modOverview = await call('get');
  assert(modOverview.moderation);
  assert.equal(modOverview.accounts, null);
  for (const section of ['users', 'audit'])
    await call('get', { query: 'section=' + section, status: 403 });
  await post({ command: 'editor', userId: 4, enabled: true }, 403);
  await post({ command: 'featured', ids: [id], enabled: true }, 403);
  await action({ action: 'movieDelete', id }, 403);
  await action({
    action: 'movieSave',
    ...material,
    id,
    title: 'Moderator edit',
  });
  await call('series', {
    body: {
      action: 'saveSeason',
      movieId: id,
      number: 1,
      title: 'First',
      episodeCount: 1,
    },
  });
  await actor(1);
  let list = await call('get', { query: 'section=users&role=editor' });
  assert.equal(list.total, 2);
  assert(list.items.every((u) => u.isEditor));
  assert(!('sessionVersion' in list.items[0]));
  await call('get', { query: 'section=users&role=nope', status: 400 });
  await call('get', { query: 'section=users&page=-1', status: 400 });
  await call('get', { query: 'section=nope', status: 400 });
  await call('post', {
    body: { command: 'editor', userId: 4, enabled: true },
    headers: { origin: 'https://evil.test' },
    status: 403,
  });
  for (const command of ['role', 'editor', 'suspend', 'revokeSessions'])
    await post({ command, userId: 1, role: 'visitor', enabled: true }, 400);
  await post({ command: 'role', userId: 999, role: 'admin' }, 404);
  await post({ command: 'role', userId: 4, role: 'god' }, 400);
  await post({ command: 'editor', userId: 4, enabled: 'yes' }, 400);
  await post({ command: 'editor', userId: 4, enabled: true });
  await actor(4);
  await action({ action: 'movieSave', ...material, title: 'New editor film' });
  await actor(1);
  await post({ command: 'editor', userId: 4, enabled: false });
  await actor(4);
  await action({ action: 'movieSave', ...material, title: 'Revoked' }, 403);
  await actor(1);
  await post({ command: 'editor', userId: 2, enabled: true });
  await post({ command: 'editor', userId: 5, enabled: false }); // Independent at every role.
  await post(
    { command: 'suspend', userId: 5, enabled: true, reason: 'No' },
    400,
  );
  await post(
    { command: 'suspend', userId: 4, enabled: true, reason: ' ' },
    400,
  );
  await post({ command: 'suspend', userId: 4, enabled: true, reason: 'Spam' });
  assert.equal(
    (await pg.query('select session_version from mg_users where id=4')).rows[0]
      .session_version,
    1,
  );
  list = await call('get', { query: 'section=users&state=suspended&q=Reader' });
  assert.equal(list.total, 1);
  assert.equal(list.items[0].suspensionReason, 'Spam');
  await post({ command: 'suspend', userId: 4, enabled: false });
  await post({ command: 'revokeSessions', userId: 4 });
  assert.equal(
    (await pg.query('select session_version from mg_users where id=4')).rows[0]
      .session_version,
    3,
  );
  await post({ command: 'role', userId: 4, role: 'vip' });
  assert.equal(
    (await pg.query('select session_version from mg_users where id=4')).rows[0]
      .session_version,
    4,
  );
  await post({ command: 'featured', ids: [], enabled: true }, 400);
  await post({ command: 'featured', ids: [id, 9999], enabled: true }, 404);
  assert.equal(
    (await pg.query('select featured from mg_movies where id=$1', [id])).rows[0]
      .featured,
    false,
  );
  await post({ command: 'featured', ids: [id, id], enabled: true });
  assert.equal(
    (await pg.query('select featured from mg_movies where id=$1', [id])).rows[0]
      .featured,
    true,
  );
  await post({ command: 'club', movieId: id });
  await post({ command: 'club', movieId: id });
  assert.equal(
    (await pg.query('select count(*)::int n from mg_movie_club where active'))
      .rows[0].n,
    1,
  );
  await pg.query(
    "insert into mg_comments(user_id,movie_id,body)values(4,$1,'Comment body')",
    [id],
  );
  let comments = await call('get', { query: 'section=comments&q=Comment' });
  const commentId = comments.items[0].id;
  await action({ action: 'commentSpoiler', commentId, spoiler: true });
  comments = await call('get', { query: 'section=comments&state=spoiler' });
  assert.equal(comments.total, 1);
  await action({ action: 'commentDelete', commentId }, 400);
  await action({
    action: 'commentDelete',
    commentId,
    reason: 'Rule violation',
  });
  comments = await call('get', { query: 'section=comments' });
  assert.equal(comments.total, 0);
  let audit = await call('get', { query: 'section=audit&action=user.editor' });
  assert(audit.total >= 4);
  assert(audit.items.every((a) => a.action === 'user.editor'));
  // No-op capability updates should not pollute journal.
  const before = audit.total;
  await post({ command: 'editor', userId: 4, enabled: false });
  audit = await call('get', { query: 'section=audit&action=user.editor' });
  assert.equal(audit.total, before);
  // Journal failure must roll back account and catalogue mutations.
  await pg.exec(
    "CREATE FUNCTION fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'forced audit failure';END$$;CREATE TRIGGER fail_audit BEFORE INSERT ON mg_admin_audit FOR EACH ROW EXECUTE FUNCTION fail_audit();",
  );
  await post({ command: 'editor', userId: 4, enabled: true }, 500);
  assert.equal(
    (await pg.query('select is_editor from mg_users where id=4')).rows[0]
      .is_editor,
    false,
  );
  await post({ command: 'featured', ids: [id], enabled: false }, 500);
  assert.equal(
    (await pg.query('select featured from mg_movies where id=$1', [id])).rows[0]
      .featured,
    true,
  );
  await action(
    { action: 'movieSave', ...material, title: 'Must rollback' },
    500,
  );
  assert.equal(
    (
      await pg.query(
        "select count(*)::int n from mg_movies where title='Must rollback'",
      )
    ).rows[0].n,
    0,
  );
  await pg.exec(
    'DROP TRIGGER fail_audit ON mg_admin_audit;DROP FUNCTION fail_audit();',
  );
  await action({ action: 'movieDelete', id });
  audit = await call('get', { query: 'section=audit&action=movie.delete' });
  assert.equal(audit.total, 1);
  assert.equal(audit.items[0].summary, 'Moderator edit');
  await pg.exec(
    "INSERT INTO mg_users(id,email,username) SELECT n,'pagination-'||n||'@test','Page'||n FROM generate_series(10,35)n;",
  );
  const pageOne = await call('get', { query: 'section=users&page=1' }),
    pageTwo = await call('get', { query: 'section=users&page=2' });
  assert.equal(pageOne.total, 31);
  assert.equal(pageOne.pages, 2);
  assert.equal(pageOne.items.length, 25);
  assert.equal(pageTwo.items.length, 6);
  assert.equal(
    new Set([...pageOne.items, ...pageTwo.items].map((row) => row.id)).size,
    31,
  );
  console.log(
    `Passed ${calls} actual admin/API checks: permission matrix, independent editors at all roles, protected self/admin accounts, suspension/revocation versions, private paginated user/search/filter data, catalogue/club controls, moderation and transactional audit rollback.`,
  );
} finally {
  delete globalThis.__db;
  delete globalThis.__user;
  await pg.close();
}
