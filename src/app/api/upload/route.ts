import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Инициализация клиента Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Используем сервисный ключ для обхода RLS при загрузке
);

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Необходимо войти' }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get('file');
    const kind = String(form.get('kind') || 'avatar');

    if (!(file instanceof File) || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      throw Error('Загрузите JPG, PNG или WebP до 4 МБ');
    }
    if (kind === 'poster' && !['admin', 'moderator'].includes(user.role)) {
      throw Error('Недостаточно прав');
    }

    const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
    const fileName = `${randomUUID()}.${ext}`;
    
    // Загружаем файл в бакет 'uploads'
    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(fileName, await file.arrayBuffer(), { contentType: file.type });

    if (error) throw Error('Ошибка сохранения файла в Supabase');

    // Получаем публичную ссылку
    const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(fileName);

    if (kind === 'avatar') {
      await db.update(users).set({ avatar: publicUrl }).where(eq(users.id, user.id));
    }

    return NextResponse.json({ url: publicUrl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка загрузки' }, { status: 400 });
  }
}
