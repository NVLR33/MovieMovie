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

function cleanSupabaseUrl(raw: string) {
  let url = (raw || '').trim();
  url = url.replace(/\/rest\/v1\/?$/, '');
  url = url.replace(/\/+$/, '');
  return url;
}

function cleanSupabaseKey(raw: string) {
  return (raw || '')
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/\s+/g, '');
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

    const rawUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      '';
    const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    const supabaseUrl = cleanSupabaseUrl(rawUrl);
    const serviceRoleKey = cleanSupabaseKey(rawKey);

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

    let urlHost = '';
    try {
      urlHost = new URL(supabaseUrl).host;
    } catch {
      urlHost = 'invalid-url';
    }

    const keyParts = serviceRoleKey.split('.').length;
    const keyPrefix = serviceRoleKey.slice(0, 3);

    console.error('[UPLOAD] env diag', {
      urlHost,
      keyLen: serviceRoleKey.length,
      keyPrefix,
      keyParts,
    });

    if (keyPrefix !== 'eyJ' || keyParts !== 3) {
      console.error('[UPLOAD] service_role has invalid JWT format');
      return NextResponse.json(
        {
          error:
            'Серверный ключ Supabase имеет неверный формат. В Vercel нужен свежий Legacy service_role (начинается на eyJ...), а не sb_secret_...',
        },
        { status: 500 }
      );
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

      if (
        uploadError.message.includes('Invalid Compact JWS') ||
        uploadError.message.includes('JWS') ||
        uploadError.message.includes('JWT') ||
        uploadError.message.includes('invalid JWT')
      ) {
        return NextResponse.json(
          {
            error:
              'Supabase отклонил серверный ключ (Invalid Compact JWS). Нужен свежий Legacy service_role от того же проекта, что и URL, без пробелов и кавычек.',
          },
          { status: 500 }
        );
      }

      if (
        uploadError.message.toLowerCase().includes('bucket') &&
        uploadError.message.toLowerCase().includes('not found')
      ) {
        return NextResponse.json(
          {
            error:
              'В Supabase Storage не найден бакет uploads. Создай публичный бакет uploads.',
          },
          { status: 500 }
        );
      }

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
      await db.update(users).set({ avatar: url }).where(eq(users.id, user.id));
    }

    if (kind === 'header') {
      await db.update(users).set({ headerImage: url }).where(eq(users.id, user.id));
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
