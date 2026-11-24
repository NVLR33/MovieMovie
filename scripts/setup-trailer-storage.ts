import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { MAX_TRAILER_BYTES, TRAILER_TYPES } from '../src/lib/trailers';
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error('Configure Supabase Storage server environment first.');
  const storage = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  }).storage;
  const { data, error } = await storage.getBucket('trailers');
  if (
    error &&
    String(error.status) !== '404' &&
    !/not found/i.test(error.message)
  )
    throw new Error('Cannot inspect trailers bucket.');
  const types = Object.keys(TRAILER_TYPES);
  if (data) {
    if (
      !data.public ||
      Number(data.file_size_limit) !== MAX_TRAILER_BYTES ||
      data.allowed_mime_types?.length !== types.length ||
      !types.every((t) => data.allowed_mime_types?.includes(t))
    )
      throw new Error(
        'Existing trailers settings differ. Review manually; nothing was changed.',
      );
    console.log('trailers bucket verified.');
    return;
  }
  const result = await storage.createBucket('trailers', {
    public: true,
    fileSizeLimit: MAX_TRAILER_BYTES,
    allowedMimeTypes: types,
  });
  if (result.error)
    throw new Error(
      'Cannot create trailers bucket. Check Storage permissions.',
    );
  console.log(
    'Created trailers: public reads, 40 MiB, MP4/WebM. No client upload policies added.',
  );
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'Storage setup failed',
  );
  process.exitCode = 1;
});
