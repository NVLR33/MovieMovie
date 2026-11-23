import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSupabaseBundle, planMigrations, readMigrations } from '../scripts/migration-utils';

const audit = readFileSync(resolve('scripts/supabase/03-schema-audit.sql'), 'utf8');
const files = readMigrations(resolve('scripts/migrations'));

test('migration inventory has the additive upgrades in deterministic order', () => {
  assert.deepEqual(files.map(file => file.name), [
    '20261122-custom-titles.sql', '20261122-hidden-achievements.sql',
    '20261122-movie-cast.sql', '20261122-private-rewards.sql',
    '20261122-series-achievements.sql', '20261122-virtual-pet.sql', '20261122-wallet-economy.sql', '20261122-z-system-indexes.sql', '20261122-zz-realtime.sql', '20261122-zzz-full-suggestions.sql',
    '20261122-zzzz-admin-workspace.sql',
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
  assert.equal(readFileSync(resolve('scripts/supabase/01-upgrade.sql'), 'utf8'), buildSupabaseBundle(files, audit));
});

test('bundle guards the existing schema, serializes concurrent runs and commits atomically', () => {
  const sql = buildSupabaseBundle(files, audit);
  assert.match(sql, /BEGIN;/);
  assert.match(sql, /COMMIT;/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /baseline tables are missing/);
  assert.match(sql, /checksum mismatch/);
  for (const file of files) assert.equal(sql.includes(file.sql), true);
});

test('reward tables and sequences are protected from Supabase browser API roles', () => {
  const sql = files.find(file => file.name === '20261122-private-rewards.sql')!.sql;
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


test('series catalog, ratings and permanent discoveries are private and constrained', () => {
  const sql = files.find(file => file.name === '20261122-series-achievements.sql')!.sql;
  assert.equal((sql.match(/ENABLE ROW LEVEL SECURITY/g) || []).length, 6);
  assert.match(sql, /REVOKE ALL ON SEQUENCE/);
  assert.match(sql, /value BETWEEN 0.5 AND 10/);
  assert.match(sql, /mg_series_completion_unique/);
  assert.match(sql, /ON CONFLICT \(movie_id\) DO NOTHING/);
  assert.equal(/CREATE POLICY/i.test(sql), false);
});


test('pet economy is constrained, private, deduplicated and does not mint retrospective currency', () => {
  const sql = files.find(file => file.name === '20261122-virtual-pet.sql')!.sql;
  assert.match(sql, /CHECK\(balance >= 0\)/);
  assert.match(sql, /mg_popcorn_source_unique/);
  assert.match(sql, /'baseline', 0/);
  assert.match(sql, /ON CONFLICT \(user_id,source_key\) DO NOTHING/);
  assert.equal((sql.match(/ENABLE ROW LEVEL SECURITY/g) || []).length, 2);
  assert.match(sql, /REVOKE ALL ON SEQUENCE/);
  assert.equal(/CREATE POLICY/i.test(sql), false);
});


test('wallet upgrade preserves existing balances and constrains fractional production', () => {
  const sql = files.find(file => file.name === '20261122-wallet-economy.sql')!.sql;
  assert.match(sql, /ADD COLUMN IF NOT EXISTS production_carry integer NOT NULL DEFAULT 0/);
  assert.match(sql, /production_carry BETWEEN 0 AND 3599999/);
  assert.equal(/UPDATE\s+mg_cinema_pets/i.test(sql), false);
  assert.equal(/DELETE|TRUNCATE|DROP/i.test(sql), false);
});


test('SQL Editor bundle skips applied files and verifies the whole schema before commit', () => {
  const sql = buildSupabaseBundle(files, audit);
  assert.match(sql, /IF NOT EXISTS \(SELECT 1 FROM moviemovie_migrations.history WHERE name/);
  assert.match(sql, /EXECUTE \$file_/);
  assert.match(sql, /DO \$verify_schema\$/);
  assert(sql.indexOf('DO $verify_schema$') < sql.indexOf('COMMIT;'));
});


test('realtime revisions are durable, private and transactional with guarded image writes', () => {
  const sql = files.find(file => file.name === '20261122-zz-realtime.sql')!.sql;
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /SECURITY DEFINER SET search_path = pg_catalog, public/);
  assert.match(sql, /ON CONFLICT\(audience_id\) DO UPDATE/);
  assert.match(sql, /before_row=after_row/);
  assert.match(sql, /CREATE TRIGGER mg_movie_image_urls BEFORE INSERT OR UPDATE OF poster,backdrop/);
  assert.match(sql, /current_value IS DISTINCT FROM previous_value/);
  assert.match(sql, /REVOKE ALL ON FUNCTION/);
});

test('admin workspace migration adds independent capability, session revocation and private audit', () => {
  const sql = files.find(file => file.name === '20261122-zzzz-admin-workspace.sql')!.sql;
  for (const column of ['is_editor', 'is_suspended', 'suspension_reason', 'session_version']) assert(sql.includes('ADD COLUMN IF NOT EXISTS ' + column));
  assert.match(sql, /ALTER TABLE mg_admin_audit ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE mg_admin_audit FROM PUBLIC/);
  assert.match(sql, /REVOKE ALL ON SEQUENCE mg_admin_audit_id_seq FROM PUBLIC/);
  assert.match(sql, /ARRAY\['anon','authenticated'\]/);
  assert.equal(/CREATE POLICY/i.test(sql), false);
  assert.equal(/UPDATE mg_users SET role/i.test(sql), false);
});
