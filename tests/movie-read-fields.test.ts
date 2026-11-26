import assert from 'node:assert/strict';
import { test } from 'node:test';
import { drizzle } from 'drizzle-orm/node-postgres';
import { movies } from '../src/db/schema';
import { movieReadFields } from '../src/lib/movie-read-fields';
test('optional trailer reads use row JSON and never reference a possibly absent column', () => {
  const query = drizzle.mock().select(movieReadFields).from(movies).toSQL();
  assert.match(query.sql, /to_jsonb\("mg_movies"\)/);
  assert.match(query.sql, /->>'trailer_url'/);
  assert(!query.sql.includes('"mg_movies"."trailer_url"'));
  assert.match(query.sql, /"title"/);
  assert.match(query.sql, /"watch_url"/);
});
