import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSupabaseBundle, planMigrations, readMigrations } from '../scripts/migration-utils';

const files = readMigrations(resolve('scripts/migrations'));

test('migration inventory has the four additive upgrades in deterministic order', () => {
  assert.deepEqual(files.map(file => file.name), [
    '20261122-custom-titles.sql', '20261122-hidden-achievements.sql',
    '20261122-movie-cast.sql', '20261122-private-rewards.sql',
  ]);
  for (const file of files) {
    assert.equal(file.checksum, createHash('sha256').update(file.sql).digest('hex'));
    assert.equal(/^\s*(DROP|TRUNCATE)\b/im.test(file.sql), false);
  }
});

test('fresh databases need every migration; current databases need none', () => {
  assert.equal(planMigrations(files, []).length, files.length);
  assert.deepEqual(planMigrations(files, files), []);
});

test('partially applied batches only plan missing files without mutating inputs', () => {
  const before = structuredClone(files);
  assert.deepEqual(planMigrations(files, files.slice(0, 2)).map(file => file.name), files.slice(2).map(file => file.name));
  assert.deepEqual(files, before);
});

test('editing an applied migration fails closed instead of silently skipping it', () => {
  assert.throws(() => planMigrations(files, [{ name: files[0].name, checksum: 'different' }]), /Checksum mismatch/);
});

test('committed SQL Editor bundle exactly matches the migration source files', () => {
  assert.equal(readFileSync(resolve('scripts/supabase/01-upgrade.sql'), 'utf8'), buildSupabaseBundle(files));
});

test('bundle guards the existing schema, serializes concurrent runs and commits atomically', () => {
  const sql = buildSupabaseBundle(files);
  assert.match(sql, /BEGIN;/);
  assert.match(sql, /COMMIT;/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /baseline tables are missing/);
  assert.match(sql, /checksum mismatch/);
  for (const file of files) assert.equal(sql.includes(file.sql), true);
});

test('reward tables and sequences are protected from Supabase browser API roles', () => {
  const sql = files.at(-1)!.sql;
  assert.equal((sql.match(/ENABLE ROW LEVEL SECURITY/g) || []).length, 3);
  assert.match(sql, /FROM PUBLIC/);
  assert.match(sql, /\['anon', 'authenticated'\]/);
  assert.match(sql, /REVOKE ALL ON SEQUENCE/);
  assert.equal(/CREATE POLICY/i.test(sql), false);
});

test('CI migrations are manual, not triggered by pushes or untrusted PRs', () => {
  const workflow = readFileSync(resolve('.github/workflows/supabase-migrations.yml'), 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /environment: production/);
  assert.equal(/^\s*(push|pull_request|pull_request_target):/m.test(workflow), false);
  assert.match(workflow, /secrets.SUPABASE_DB_URL/);
});
