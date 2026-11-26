import { sql } from 'drizzle-orm';
import type { db } from '@/db';
import { RequestError } from './request-validation';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Never auto-migrate a production database from a web request or silently lose a trailer. */
export async function requireTrailerSchema(tx: Transaction) {
  const result = await tx.execute<{ ready: boolean }>(sql`
    select exists (
      select 1 from pg_catalog.pg_attribute
      where attrelid = to_regclass('public.mg_movies')
        and attname = 'trailer_url' and not attisdropped
    ) as ready
  `);
  if (!result.rows[0]?.ready) {
    throw new RequestError(
      'Сохранение материалов временно недоступно: администратору нужно применить миграцию 20261122-zzzzz-trailers.sql (поле trailer_url). Просмотр каталога доступен.',
      503,
    );
  }
}
