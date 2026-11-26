import { getTableColumns, sql } from 'drizzle-orm';
import { movies } from '@/db/schema';

/** Rolling-deploy compatibility: optional trailer metadata must not break the catalog.
 * PostgreSQL row-to-JSON lookup returns NULL if the column is absent, without ever
 * naming that column in SQL. Other missing schema still fails normally.
 */
export const movieReadFields = {
  ...getTableColumns(movies),
  trailerUrl: sql<string>`coalesce(to_jsonb(${movies})->>'trailer_url', '')`.as(
    'trailer_url',
  ),
};
