import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { RequestError } from './request-validation';
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Fail before a write; no runtime DDL and no silently discarded playback URLs. */
export async function requirePlaybackSchema(
  tx: Transaction,
  episodes = false,
) {
  const result = await tx.execute<{ ready: boolean }>(sql`
    select exists (select 1 from pg_catalog.pg_attribute
      where attrelid = to_regclass(${episodes ? 'public.mg_series_episodes' : 'public.mg_movies'})
        and attname = 'playback_url' and not attisdropped) as ready
  `);
  if (!result.rows[0]?.ready)
    throw new RequestError(
      'Сохранение временно недоступно: администратору нужно применить миграцию 20261122-zzzzzz-playback.sql (playback_url). Просмотр каталога доступен.',
      503,
    );
}
