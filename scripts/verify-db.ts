import 'dotenv/config';
import { Client } from 'pg';
import { checkDatabase } from './database-checks';

async function main() {
  const connectionString = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Set MIGRATION_DATABASE_URL or DATABASE_URL in the environment. Never send credentials in chat.');
  const client = new Client({ connectionString, connectionTimeoutMillis: 10_000, application_name: 'moviemovie-verify' });
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY; SET LOCAL statement_timeout = '120s'");
    const count = await checkDatabase(sql => client.query(sql));
    await client.query('COMMIT');
    console.log(`OK: ${count} read-only schema and security readiness checks. No data changed.`);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* Connection might not have opened. */ }
    if (error instanceof Error && error.message.startsWith('Database verification')) throw error;
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    throw new Error(`Database verification could not finish${code ? ` (${code})` : ''}. Check connectivity, permissions and baseline schema in Supabase. Connection details were not logged.`);
  } finally {
    await client.end();
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Verification failed'); process.exitCode = 1; });
