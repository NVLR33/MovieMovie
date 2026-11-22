import { requireSameOrigin, RequestError, requestFailure } from '@/lib/request-validation';
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

import { validImageBytes } from '@/lib/image-storage';

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
    requireSameOrigin(req);
    if (Number(req.headers.get('content-length')) > MAX_FILE_SIZE + 65536) return NextResponse.json({ error: 'Изображение слишком большое' }, { status: 413 });
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
            'Хранилище изображений не настроено. Проверьте серверные переменные Supabase Storage.',
        },
        { status: 500 }
      );
    }

    // Supabase supports both legacy service_role JWTs and modern sb_secret_ keys.
    // Do not parse key internals or log fragments of server credentials.
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

    if (!validImageBytes(buffer, file.type)) return NextResponse.json({ error: 'Содержимое файла не соответствует JPEG, PNG или WebP' }, { status: 400 });

    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(path, buffer, {
        contentType: file.type,
        cacheControl: '31536000',
        upsert: false,
      });

    if (uploadError) {
      console.error('[UPLOAD] Supabase Storage:', uploadError.message);
      return NextResponse.json(
        {
          error: 'Не удалось загрузить изображение в хранилище. Повторите позже.',
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
    if (error instanceof RequestError) return requestFailure(error);
    console.error('[UPLOAD]', error);
    return NextResponse.json(
      {
        error: 'Не удалось загрузить изображение. Повторите позже.',
      },
      { status: 500 }
    );
  }
}
