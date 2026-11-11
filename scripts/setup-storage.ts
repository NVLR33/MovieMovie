import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function setupStorage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Ошибка: Не найдены переменные SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.log('📦 Создаем бакет "uploads" в Supabase Storage...');

  const { data, error } = await supabase.storage.createBucket('uploads', {
    public: true,
    fileSizeLimit: 4 * 1024 * 1024, // 4MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });

  if (error) {
    if (error.message.includes('already exists') || error.message.includes('Duplicate')) {
      console.log('✅ Бакет "uploads" уже существует и готов к работе!');
    } else {
      console.error('❌ Ошибка создания бакета:', error.message);
    }
  } else {
    console.log('✅ Бакет "uploads" успешно создан!');
  }
}

setupStorage().catch(console.error);
