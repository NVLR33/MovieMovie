Это из-за вставки — ты случайно вставил в `.ts` файл весь мой текст вместе с объяснением.

Ошибка прямо об этом говорит:

```
1 | Понял, раз своя аватарка тоже не грузится...
```

TypeScript-файл не может начинаться с русского текста. Там должен быть только код с `import ...`

Сейчас чиним билд. Ничего с ключами пока делать не надо.

### 1. Открой файл

GitHub → `NVLR33/MovieMovie` → `main`:

`src/app/api/upload/route.ts`

Нажми карандаш **Edit**.

### 2. Удали всё и вставь только код

Нажми `Ctrl+A` → `Delete`, затем вставь **только код ниже**, от первой строки `import` до последней `}`.

Без моего текста сверху/снизу.

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 4 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const ALLOWED_KINDS = [
  'avatar',
  'header',
  'poster',
  'backdrop',
] as const;

type UploadKind = (typeof ALLOWED_KINDS)[number];

function cleanUrl(value: string | undefined) {
  if (!value) return '';
  return value
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/\s+/g, '')
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/+$/, '');
}

function cleanKey(value: string | undefined) {
  if (!value) return '';
  return value
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/[\r\n\s]+/g, '');
}

export async function POST(req: NextRequest) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Необходимо войти в аккаунт' },
      { status: 401 }
    );
  }

  try {
    const form = await req.formData();

    const file = form.get('file');
    const kind = String(form.get('kind') || 'avatar');

    if (!ALLOWED_KINDS.includes(kind as UploadKind)) {
      return NextResponse.json(
        { error: 'Недопустимый тип загрузки' },
        { status: 400 }
      );
    }

    if (
      ['poster', 'backdrop'].includes(kind) &&
      !['admin', 'moderator'].includes(user.role)
    ) {
      return NextResponse.json(
        { error: 'Недостаточно прав для загрузки изображений материалов' },
        { status: 403 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Файл не найден' },
        { status: 400 }
      );
    }

    const extension = ALLOWED_TYPES[file.type];

    if (!extension) {
      return NextResponse.json(
        { error: 'Разрешены только изображения JPG, PNG и WebP' },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Размер изображения должен быть от 1 байта до 4 МБ' },
        { status: 400 }
      );
    }

    const supabaseUrl = cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const serviceRoleKey = cleanKey(process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[UPLOAD] Supabase Storage environment variables missing');
      return NextResponse.json(
        {
          error:
            'Хранилище изображений не настроено. Проверьте переменные Supabase в Vercel.',
        },
        { status: 500 }
      );
    }

    let host = 'invalid-url';
    try {
      host = new URL(supabaseUrl).host;
    } catch {
      host = 'invalid-url';
    }

    const keyParts = serviceRoleKey.split('.').length;

    console.error('[UPLOAD] env check', {
      host,
      urlLen: supabaseUrl.length,
      keyLen: serviceRoleKey.length,
      keyParts,
      keyPrefix: serviceRoleKey.slice(0, 4),
    });

    if (serviceRoleKey.startsWith('sb_')) {
      console.error('[UPLOAD] looks like new sb_ key, need legacy service_role JWT');
      return NextResponse.json(
        {
          error:
            'В Vercel лежит новый ключ sb_..., а нужен legacy service_role (начинается с eyJ) из Settings → API Keys → Legacy API Keys.',
        },
        { status: 500 }
      );
    }

    if (keyParts !== 3) {
      console.error('[UPLOAD] service key is not JWT');
      return NextResponse.json(
        {
          error:
            'Ключ Supabase не похож на JWT. Нужен именно service_role из Legacy API Keys, а не JWT Secret.',
        },
        { status: 500 }
      );
    }

    try {
      const payloadJson = Buffer.from(
        serviceRoleKey.split('.')[1],
        'base64'
      ).toString('utf8');
      const payload = JSON.parse(payloadJson) as { ref?: string };
      if (payload.ref && !supabaseUrl.includes(payload.ref)) {
        console.error('[UPLOAD] key ref mismatch', {
          host,
          keyRef: payload.ref,
        });
        return NextResponse.json(
          {
            error:
              'URL и ключ Supabase из разных проектов. Проверьте, что оба взяты из moviemovie / main PRODUCTION.',
          },
          { status: 500 }
        );
      }
    } catch {
      // дальше Supabase сам вернет ошибку
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const filename = `${randomUUID()}.${extension}`;

    const path =
      kind === 'avatar' || kind === 'header'
        ? `${kind}/${user.id}/${filename}`
        : `${kind}/${filename}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(path, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('[UPLOAD] Supabase Storage:', uploadError.message);
      return NextResponse.json(
        {
          error: `Не удалось загрузить изображение: ${uploadError.message}`,
        },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(path);

    const url = publicUrlData.publicUrl;

    if (!url) {
      throw new Error('Не удалось получить ссылку на изображение');
    }

    if (kind === 'avatar') {
      await db
        .update(users)
        .set({ avatar: url })
        .where(eq(users.id, user.id));
    }

    if (kind === 'header') {
      await db
        .update(users)
        .set({ headerImage: url })
        .where(eq(users.id, user.id));
    }

    return NextResponse.json({
      ok: true,
      url,
    });
  } catch (error) {
    console.error('[UPLOAD]', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Неизвестная ошибка загрузки',
      },
      { status: 500 }
    );
  }
}
