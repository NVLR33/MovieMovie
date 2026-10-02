import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

// [API:UPLOAD] Upload to Supabase Storage in production, local FS in sandbox/dev.
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
    if (['poster'].includes(kind) && !['admin', 'moderator'].includes(user.role)) {
      throw Error('Недостаточно прав');
    }

    const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
    const name = `${randomUUID()}.${ext}`;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let url = '';

    if (supabaseUrl && serviceRole) {
      const supabase = createClient(supabaseUrl, serviceRole);
      const path = `${kind}/${name}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error } = await supabase.storage.from('uploads').upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw Error(`Ошибка Supabase Storage: ${error.message}`);
      const { data } = supabase.storage.from('uploads').getPublicUrl(path);
      url = data.publicUrl;
    } else {
      const dir = join(process.cwd(), 'public', 'uploads', kind);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, name), Buffer.from(await file.arrayBuffer()));
      url = `/uploads/${kind}/${name}`;
    }

    if (kind === 'avatar') await db.update(users).set({ avatar: url }).where(eq(users.id, user.id));
    if (kind === 'header') await db.update(users).set({ headerImage: url }).where(eq(users.id, user.id));

    return NextResponse.json({ url });
  } catch (e) {
    console.error('[UPLOAD]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка загрузки' }, { status: 400 });
  }
}
