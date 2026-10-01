// [SCRIPT:SETUP_DB] Run once after first Vercel deploy to push schema and seed data.
// Usage: npx tsx scripts/setup-db.ts
import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';

const run = promisify(exec);

async function main() {
  console.log('📦 Pushing schema to database...');
  const { stdout, stderr } = await run('npx drizzle-kit push');
  console.log(stdout);
  if (stderr) console.warn(stderr);
  console.log('✅ Schema applied. The seed data will be created automatically on first site visit.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
