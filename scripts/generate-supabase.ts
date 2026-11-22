import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSupabaseBundle, readMigrations } from './migration-utils';

const files = readMigrations(resolve('scripts/migrations'));
if (!files.length) throw new Error('No migration files found');
mkdirSync(resolve('scripts/supabase'), { recursive: true });
writeFileSync(resolve('scripts/supabase/01-upgrade.sql'), buildSupabaseBundle(files));
console.log(`Generated scripts/supabase/01-upgrade.sql from ${files.length} migrations.`);
