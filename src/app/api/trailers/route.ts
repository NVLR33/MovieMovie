import { requireTrailerSchema } from '@/lib/trailer-schema';
import { db } from '@/db';
import { users, adminAudit } from '@/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { writeAdminAudit } from '@/lib/admin-audit';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getUser } from '@/lib/auth';
import { canCreateMaterial } from '@/lib/permissions';
import {
  requireSameOrigin,
  RequestError,
  requestFailure,
} from '@/lib/request-validation';
import {
  MAX_TRAILER_BYTES,
  TRAILER_TYPES,
  validTrailerHeader,
} from '@/lib/trailers';
export const runtime = 'nodejs';
// Dedicated video bucket. Never relax the image bucket or accept Base64 in material JSON.
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await getUser();
    if (!user) throw new RequestError('Необходимо войти', 401);
    if (!canCreateMaterial(user))
      throw new RequestError('Недостаточно прав', 403);
    const type = request.headers.get('content-type') || '',
      extension = Object.hasOwn(TRAILER_TYPES, type)
        ? TRAILER_TYPES[type]
        : null;
    if (!extension) throw new RequestError('Разрешены только MP4 и WebM', 415);
    if (Number(request.headers.get('content-length')) > MAX_TRAILER_BYTES)
      throw new RequestError('Максимум 40 МБ', 413);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
      throw new RequestError(
        'Видеохранилище не настроено. Пока используй ссылку на трейлер.',
        503,
      );
    // Durable per-editor budget, serialized across instances; failed attempts count too.
    await db.transaction(async (tx) => {
      await requireTrailerSchema(tx);
      const [actor] = await tx
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .for('update');
      if (!canCreateMaterial(actor))
        throw new RequestError('Права изменились', 403);
      const [budget] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(adminAudit)
        .where(
          and(
            eq(adminAudit.actorId, user.id),
            eq(adminAudit.action, 'trailer.upload'),
            gte(adminAudit.createdAt, new Date(Date.now() - 3600000)),
          ),
        );
      if (budget.count >= 6)
        throw new RequestError(
          'Не более 6 загрузок трейлеров в час. Попробуй позже.',
          429,
        );
      await writeAdminAudit(
        tx,
        actor,
        'trailer.upload',
        'storage',
        null,
        'Попытка загрузки трейлера',
      );
    });
    const reader = request.body?.getReader();
    if (!reader) throw new RequestError('Пустой файл');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_TRAILER_BYTES) {
          await reader.cancel();
          throw new RequestError('Максимум 40 МБ', 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const buffer = Buffer.concat(chunks);
    if (!validTrailerHeader(buffer, type))
      throw new RequestError('Содержимое не соответствует MP4 / WebM');
    const storage = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    }).storage.from('trailers');
    const path = `${user.id}/${randomUUID()}.${extension}`;
    const { error } = await storage.upload(path, buffer, {
      contentType: type,
      cacheControl: '31536000',
      upsert: false,
    });
    if (error)
      throw new RequestError(
        'Не удалось загрузить видео. Проверь настройку отдельного bucket trailers (40 МБ, MP4/WebM).',
        503,
      );
    return NextResponse.json({
      ok: true,
      url: storage.getPublicUrl(path).data.publicUrl,
    });
  } catch (error) {
    return requestFailure(error, 'Не удалось загрузить трейлер');
  }
}
