import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type DatabaseCheck = { check_name: string; result: string };
export const DATABASE_CHECK_FILES = ['02-verify.sql', '03-schema-audit.sql'] as const;
export async function checkDatabase(query: (sql: string) => Promise<{ rows: DatabaseCheck[] }>) {
  const rows: DatabaseCheck[] = [];
  for (const name of DATABASE_CHECK_FILES) {
    const result = await query(readFileSync(resolve('scripts/supabase', name), 'utf8'));
    if (!result.rows.length) throw new Error(`Database verification returned no checks: ${name}`);
    rows.push(...result.rows);
  }
  const failed = rows.filter(row => row.result !== 'OK');
  if (failed.length) throw new Error(`Database verification failed (${failed.length}): ${failed.slice(0, 15).map(row => row.check_name).join('; ')}. Run scripts/supabase/03-schema-audit.sql for the complete report. No data is repaired or removed automatically.`);
  return rows.length;
}
