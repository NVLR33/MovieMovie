-- OPTIONAL Supabase-only step for uploads. Not part of PostgreSQL schema migrations.
-- Existing buckets are never made public or reconfigured silently; no file rows are touched.
-- Run as postgres in SQL Editor. Upload writes use the server service-role key, not browser policies.
BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '120s';
DO $storage_preflight$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE EXCEPTION 'Supabase Storage is not initialized. Enable Storage before running this optional script.';
  END IF;
END
$storage_preflight$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('uploads','uploads',true,4194304,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO NOTHING;
DO $storage_verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id='uploads' AND name='uploads' AND public IS TRUE
      AND file_size_limit=4194304
      AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp']::text[]
      AND allowed_mime_types <@ ARRAY['image/jpeg','image/png','image/webp']::text[]
  ) THEN
    RAISE EXCEPTION 'Existing uploads bucket settings differ. Review public visibility, 4 MiB limit and JPEG/PNG/WebP MIME types manually; no existing bucket was modified.';
  END IF;
END
$storage_verify$;
COMMIT;
SELECT 'Supabase uploads bucket' AS check_name, 'OK' AS result;
