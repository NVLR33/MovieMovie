import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as schema from '../src/db/schema';
import { buildSchemaAudit } from '../scripts/schema-audit';
import { checkDatabase, DATABASE_CHECK_FILES } from '../scripts/database-checks';

const audit = readFileSync('scripts/supabase/03-schema-audit.sql', 'utf8');
test('full schema audit is generated from every application table, not a hand-maintained subset', () => {
  const tables = Object.values(schema);
  assert.equal(tables.length, 32);
  assert.equal(audit, buildSchemaAudit(tables));
  for (const table of tables) {
    const config = getTableConfig(table);
    assert(audit.includes(`('${config.name}',`));
    for (const col of config.columns) assert(audit.includes(`('${config.name}', '${col.name}',`));
  }
  assert.equal(/^\s*(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE)\b/im.test(audit), false);
});
test('structural audit covers types, keys, delete behavior, valid indexes and required RLS', () => {
  for (const token of ['format_type', 'attnotnull', 'needs_default', 'indisunique', 'indisvalid', 'indisready', 'convalidated', 'foreign_columns', 'delete_action', 'relrowsecurity']) assert(audit.includes(token));
  assert(audit.includes("'timestamp without time zone'"));
  assert(audit.includes("'timestamp with time zone'"));
});
test('automatic verification checks both readiness and the complete schema', async () => {
  const calls: string[] = [];
  const count = await checkDatabase(async sql => { calls.push(sql); return { rows: [{ check_name: 'Structural test', result: 'OK' }] }; });
  assert.equal(count, 2); assert.equal(calls.length, DATABASE_CHECK_FILES.length);
  assert(calls[1].includes('expected_columns'));
});
test('verification fails on missing checks or schema drift rather than reporting success', async () => {
  await assert.rejects(() => checkDatabase(async () => ({ rows: [] })), /no checks/);
  await assert.rejects(() => checkDatabase(async () => ({ rows: [{ check_name: 'Column: mg_users.bio', result: 'NEEDS ATTENTION' }] })), /verification failed.*mg_users.bio/);
});
test('manual deployment automation verifies the schema and does not run on normal pushes', () => {
  const workflow = readFileSync('.github/workflows/supabase-migrations.yml', 'utf8');
  assert.match(workflow, /npm run db:verify/); assert.match(workflow, /npm run test:wallet/);
  const runner = readFileSync('scripts/migrate-db.ts', 'utf8');
  assert(runner.indexOf('await checkDatabase') < runner.indexOf("await client.query('COMMIT')"));
});
test('Storage setup does not expose or rewrite an existing private bucket', () => {
  const sql = readFileSync('scripts/supabase/04-storage-setup.sql', 'utf8');
  assert.match(sql, /ON CONFLICT\(id\) DO NOTHING/);
  assert.equal(/^\s*(UPDATE|DELETE|TRUNCATE|CREATE POLICY|GRANT)\b/im.test(sql), false);
  assert.match(sql, /Existing uploads bucket settings differ/);
});
