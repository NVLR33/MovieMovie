// Explicit maintenance tool. Dry-run by default; never drops originals before uploading.
import 'dotenv/config';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { MAX_IMAGE_BYTES } from '../src/lib/image-storage';
import { transferInlineImage } from '../src/lib/inline-image-migration';
const fields = [['mg_movies','poster'],['mg_movies','backdrop'],['mg_users','avatar'],['mg_users','header_image']] as const;
async function main() {
  const args = process.argv.slice(2);
  if (args.some(a => !['--dry-run','--apply'].includes(a)) || args.length > 1) throw new Error('Usage: npm run images:migrate -- [--dry-run | --apply]');
  const apply = args.includes('--apply');
  const connectionString = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Database environment is missing');
  if (apply && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) throw new Error('Storage environment is missing');
  const storage = apply ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(30000) }) } }).storage.from('uploads') : null;
  const client = new Client({ connectionString, connectionTimeoutMillis: 10000 });
  let failed = 0;
  try {
    await client.connect();
    await client.query("SET lock_timeout = '10s'; SET statement_timeout = '30s'");
    await client.query('SELECT pg_advisory_lock(1808523042)');
    for (const [table, field] of fields) {
      const summary = await client.query(`SELECT count(*)::int AS count, coalesce(sum(octet_length("${field}")),0)::text AS bytes FROM "${table}" WHERE left("${field}",5)='data:'`);
      console.log(`${table}.${field}: ${summary.rows[0].count} inline images, ${summary.rows[0].bytes} database bytes${apply ? '' : ' (dry-run, no uploads or updates)'}`);
      if (!apply) continue;
      let cursor = 0;
      while (true) {
        // At most one original in memory. Never select whole users/catalog rows.
        const found = await client.query(`SELECT id,CASE WHEN octet_length("${field}") <= ${Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 100} THEN "${field}" ELSE NULL END AS image FROM "${table}" WHERE id>$1 AND left("${field}",5)='data:' ORDER BY id LIMIT 1`, [cursor]);
        const row = found.rows[0]; if (!row) break; cursor = row.id;
        try {
          const replaced = await transferInlineImage(row.image, `legacy/${table}/${row.id}/${field}`, async (path, bytes, type) => {
            const uploaded = await storage!.upload(path, bytes, { contentType: type, upsert: false, cacheControl: '31536000' });
            if (uploaded.error) {
              const status = String('statusCode' in uploaded.error ? uploaded.error.statusCode : '');
              const exists = status === '409' || (status === '400' && /already exists|duplicate/i.test(uploaded.error.message));
              if (!exists) throw new Error('Storage upload failed');
            }
            return storage!.getPublicUrl(path).data.publicUrl;
          }, async (url, original) => {
            // A concurrent profile/editor change always wins. No transaction spans network I/O.
            const result = await client.query(`UPDATE "${table}" SET "${field}"=$1 WHERE id=$2 AND "${field}"=$3`, [url,row.id,original]);
            return result.rowCount === 1;
          });
          console.log(`${table}.${field} #${row.id}: ${replaced ? 'migrated' : 'changed concurrently; original not overwritten'}`);
        } catch { failed++; console.error(`${table}.${field} #${row.id}: not migrated; original preserved (check format, size and Storage configuration)`); }
      }
    }
  } finally { await client.end(); }
  if (failed) throw new Error(`${failed} images were left unchanged. Fix their format/configuration and rerun.`);
}
main().catch(() => { console.error('Image migration did not finish cleanly. Originals not successfully replaced are retained; no connection strings or image content logged.'); process.exitCode = 1; });
