// Rolling deployment regression. Mutates ONLY the marker-guarded disposable local DB.
// Run sequentially with other integration suites: the optional column is temporarily removed.
import assert from 'node:assert/strict';
import { Client } from 'pg';
const base = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:3000';
const connectionString = process.env.AUDIT_DATABASE_URL;
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
assert.equal(
  new URL(connectionString).searchParams.get('host'),
  '/tmp/mm-audit-pg',
);
const db = new Client({ connectionString });
await db.connect();
let userId, movieId, suggestionId, originalTrailers;
try {
  assert.equal(
    (await db.query("select value from mm_audit_fixture where key='isolated'"))
      .rows[0]?.value,
    'yes',
  );
  originalTrailers = (await db.query('select id,trailer_url from mg_movies'))
    .rows;
  const stamp = Date.now();
  const signup = await fetch(base + '/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'register',
      email: `schema-${stamp}@example.test`,
      username: `Schema${stamp}`,
      password: 'schema-isolated-regression-password',
    }),
  });
  assert.equal(signup.status, 200);
  userId = (await signup.json()).user.id;
  const cookie = signup.headers
    .getSetCookie()
    .map((s) => s.split(';')[0])
    .join('; ');
  await db.query("update mg_users set role='admin' where id=$1", [userId]);
  const material = {
    title: `Schema fixture ${stamp}`,
    description: 'Isolated schema compatibility fixture',
    category: 'Фильм',
    genre: 'Драма',
    year: 2024,
    duration: 90,
    poster: '/brand/moviemovie-logo.png',
    trailerUrl: 'https://cdn.example.test/trailer.mp4',
  };
  movieId = (
    await db.query(
      'insert into mg_movies(title,description,category,genre,year,duration,poster,trailer_url)values($1,$2,$3,$4,$5,$6,$7,$8)returning id',
      [
        material.title,
        material.description,
        material.category,
        material.genre,
        material.year,
        material.duration,
        material.poster,
        material.trailerUrl,
      ],
    )
  ).rows[0].id;
  const proposed = { ...material, title: material.title + ' proposed' };
  suggestionId = (
    await db.query(
      'insert into mg_movie_suggestions(user_id,title,year,genre,category,material)values($1,$2,$3,$4,$5,$6)returning id',
      [
        userId,
        proposed.title,
        proposed.year,
        proposed.genre,
        proposed.category,
        JSON.stringify(proposed),
      ],
    )
  ).rows[0].id;
  const post = async (body) =>
    fetch(base + '/api/action', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  try {
    await db.query('alter table mg_movies drop column trailer_url');
    for (const path of [
      '/',
      '/catalog',
      '/movie/' + movieId,
      '/api/data',
      '/api/pulse',
      '/api/profile?id=' + userId,
      '/api/series?movieId=2',
    ]) {
      const response = await fetch(base + path, { headers: { cookie } });
      assert.equal(response.status, 200, 'Legacy schema: ' + path);
      if (path === '/api/data') {
        const data = await response.json();
        assert.equal(
          data.films.find((film) => film.id === movieId).trailerUrl,
          '',
        );
        assert.equal(
          data.films.find((film) => film.id === movieId).title,
          material.title,
        );
      }
    }
    for (const body of [
      { action: 'movieSave', ...material, id: movieId },
      { action: 'movieSave', ...proposed },
      { action: 'approveSuggestion', id: suggestionId },
    ]) {
      const response = await post(body);
      assert.equal(response.status, 503);
      const result = await response.json();
      assert.match(result.error, /20261122-zzzzz-trailers\.sql/);
      assert(!/Failed query|postgresql:\/\//.test(result.error));
    }
    assert.equal(
      (
        await db.query('select status from mg_movie_suggestions where id=$1', [
          suggestionId,
        ])
      ).rows[0].status,
      'pending',
    );
    assert.equal(
      (await db.query('select title from mg_movies where id=$1', [movieId]))
        .rows[0].title,
      material.title,
    );
    assert.equal(
      (
        await db.query(
          'select count(*)::int as count from mg_movies where title=$1',
          [proposed.title],
        )
      ).rows[0].count,
      0,
    );
  } finally {
    // Restore original optional metadata even if a request/assertion fails.
    await db.query(
      "alter table mg_movies add column if not exists trailer_url text not null default ''",
    );
    for (const row of originalTrailers)
      if (row.trailer_url)
        await db.query('update mg_movies set trailer_url=$1 where id=$2', [
          row.trailer_url,
          row.id,
        ]);
  }
  // No cached negative capability: the same server immediately works after migration.
  const saved = await post({ action: 'movieSave', ...material, id: movieId });
  assert.equal(saved.status, 200);
  const data = await (
    await fetch(base + '/api/data', { headers: { cookie } })
  ).json();
  assert.equal(
    data.films.find((film) => film.id === movieId).trailerUrl,
    material.trailerUrl,
  );
  console.log(
    'Passed trailer rolling-schema compatibility: legacy-schema home/catalog/detail/data/pulse/profile/series stay 200; writes return actionable 503 with no partial publication; migration restores trailer persistence without restarting.',
  );
} finally {
  if (suggestionId)
    await db.query('delete from mg_movie_suggestions where id=$1', [
      suggestionId,
    ]);
  if (movieId) await db.query('delete from mg_movies where id=$1', [movieId]);
  if (userId) {
    await db.query('delete from mg_admin_audit where actor_id=$1', [userId]);
    await db.query('delete from mg_users where id=$1', [userId]);
  }
  await db.end();
}
