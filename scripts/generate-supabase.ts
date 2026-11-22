import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSupabaseBundle, readMigrations } from './migration-utils';
import { buildSchemaAudit } from './schema-audit';
import * as schema from '../src/db/schema';

const files = readMigrations(resolve('scripts/migrations'));
if (!files.length) throw new Error('No migration files found');
mkdirSync(resolve('scripts/supabase'), { recursive: true });
const audit = buildSchemaAudit(Object.values(schema));
writeFileSync(resolve('scripts/supabase/01-upgrade.sql'), buildSupabaseBundle(files, audit));
console.log(`Generated scripts/supabase/01-upgrade.sql from ${files.length} migrations.`);
writeFileSync(resolve('scripts/supabase/03-schema-audit.sql'), audit);
console.log('Generated full structural schema audit from Drizzle.');
