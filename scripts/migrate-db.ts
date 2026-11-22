import 'dotenv/config';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { MIGRATION_LOCK, MIGRATION_PREFLIGHT, MIGRATION_SETUP, planMigrations, readMigrations } from './migration-utils';

async function main() {
  const flags = process.argv.slice(2);
  if (flags.some(flag => !['--dry-run', '--status'].includes(flag)) || flags.length > 1) throw new Error('Usage: npm run db:migrate -- [--dry-run | --status]');
  const files = readMigrations(resolve('scripts/migrations'));
  if (!files.length) throw new Error('No migration files found');
  if (flags.includes('--dry-run')) {
    console.log('Local migration inventory (no database connection; not a remote status check):');
    for (const file of files) console.log(`${file.name}  sha256:${file.checksum}`);
    return;
  }
  const connectionString = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Set MIGRATION_DATABASE_URL or DATABASE_URL in the environment. Never put a database URL in source code.');
  const client = new Client({ connectionString, connectionTimeoutMillis: 10_000, application_name: 'moviemovie-migrations' });
  try {
    await client.connect();
    if (flags.includes('--status')) {
      const exists = await client.query<{ name: string | null }>("SELECT to_regclass('moviemovie_migrations.history')::text AS name");
      const applied = exists.rows[0].name ? (await client.query<{ name: string; checksum: string }>('SELECT name, checksum FROM moviemovie_migrations.history')).rows : [];
      const pending = new Set(planMigrations(files, applied).map(file => file.name));
      for (const file of files) console.log(`${pending.has(file.name) ? 'PENDING' : 'APPLIED'}  ${file.name}`);
      return;
    }
    await client.query('BEGIN');
    try {
      await client.query("SET LOCAL search_path = public, pg_catalog; SET LOCAL lock_timeout = '15s'; SET LOCAL statement_timeout = '120s'");
      await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK]);
      await client.query(MIGRATION_PREFLIGHT);
      await client.query(MIGRATION_SETUP);
      const applied = (await client.query<{ name: string; checksum: string }>('SELECT name, checksum FROM moviemovie_migrations.history')).rows;
      const pending = planMigrations(files, applied);
      for (const file of pending) {
        await client.query(file.sql);
        await client.query('INSERT INTO moviemovie_migrations.history(name, checksum) VALUES ($1,$2)', [file.name, file.checksum]);
      }
      await client.query('COMMIT');
      console.log(pending.length ? `Committed ${pending.length} migrations: ${pending.map(file => file.name).join(', ')}` : 'Database is up to date. No migrations applied.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    // Connection errors can contain credentials/hostnames; never echo the connection string or raw error.
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (error instanceof Error && (error.message.startsWith('Checksum mismatch') || error.message.startsWith('MovieMovie baseline'))) throw error;
    throw new Error(`Database migration failed${code ? ` (${code})` : ''}. No uncommitted migrations were retained. Check connectivity, permissions and schema using the Supabase SQL Editor.`);
  } finally {
    await client.end();
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'Migration failed'); process.exitCode = 1; });
