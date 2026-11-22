import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function setupStorage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment, never in source code.');
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const mimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const { data: existing, error: lookupError } = await supabase.storage.getBucket('uploads');
  if (lookupError && String(lookupError.status) !== '404' && !/not found/i.test(lookupError.message)) throw new Error('Cannot inspect uploads bucket. Check server Storage permissions.');
  if (existing) {
    if (!existing.public || Number(existing.file_size_limit) !== 4 * 1024 * 1024 || !Array.isArray(existing.allowed_mime_types) || existing.allowed_mime_types.length !== mimeTypes.length || !mimeTypes.every(type => existing.allowed_mime_types!.includes(type))) {
      throw new Error('Existing uploads bucket settings differ. Review public visibility, 4 MiB limit and JPEG/PNG/WebP MIME types manually. No existing bucket was changed.');
    }
    console.log('OK: uploads bucket exists and its public visibility, size and MIME settings match.');
    return;
  }
  const { error } = await supabase.storage.createBucket('uploads', { public: true, fileSizeLimit: 4 * 1024 * 1024, allowedMimeTypes: mimeTypes });
  if (error) throw new Error('Could not create uploads bucket. Check permissions or rerun if another setup created it concurrently.');
  console.log('OK: created uploads bucket (public reads, 4 MiB, JPEG/PNG/WebP). Upload writes remain server-only.');
}
setupStorage().catch(error => { console.error(error instanceof Error ? error.message : 'Storage setup failed; connection details were not logged.'); process.exitCode = 1; });
