-- Durable invalidation revisions, shared by all application instances. No event payload/history.
CREATE TABLE IF NOT EXISTS mg_realtime_versions (
  audience_id integer PRIMARY KEY CONSTRAINT mg_realtime_audience_valid CHECK(audience_id >= 0),
  revision bigint NOT NULL DEFAULT 1 CONSTRAINT mg_realtime_revision_valid CHECK(revision > 0)
);
ALTER TABLE mg_realtime_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE mg_realtime_versions FROM PUBLIC;
CREATE OR REPLACE FUNCTION mg_realtime_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $realtime$
DECLARE before_row jsonb; after_row jsonb; audiences integer[]; target integer;
BEGIN
  before_row := CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  after_row := CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  -- No-op UPDATEs must not cause refresh/read loops.
  IF TG_OP='UPDATE' AND before_row=after_row THEN RETURN NULL; END IF;
  IF TG_TABLE_NAME IN ('mg_messages','mg_friendships') THEN
    audiences := ARRAY[(before_row->>'from_id')::integer,(before_row->>'to_id')::integer,(after_row->>'from_id')::integer,(after_row->>'to_id')::integer];
  ELSIF TG_TABLE_NAME='mg_notifications' THEN
    audiences := ARRAY[(before_row->>'user_id')::integer,(after_row->>'user_id')::integer];
  ELSIF TG_TABLE_NAME='mg_movies' THEN audiences := ARRAY[0];
  ELSIF TG_TABLE_NAME='mg_users' THEN audiences := ARRAY[0,(before_row->>'id')::integer,(after_row->>'id')::integer];
  ELSE audiences := ARRAY[0,(before_row->>'user_id')::integer,(after_row->>'user_id')::integer];
  END IF;
  -- Consistent row order reduces lock inversion; revisions serialize per audience and
  -- therefore cannot miss a late commit as a sequence-ID cursor could.
  FOR target IN SELECT DISTINCT id FROM unnest(audiences) id WHERE id IS NOT NULL AND id>=0 ORDER BY id LOOP
    INSERT INTO public.mg_realtime_versions(audience_id,revision) VALUES(target,1)
      ON CONFLICT(audience_id) DO UPDATE SET revision=public.mg_realtime_versions.revision+1;
  END LOOP;
  RETURN NULL;
END
$realtime$;
REVOKE ALL ON FUNCTION mg_realtime_changed() FROM PUBLIC;
DO $triggers$
DECLARE tab text; api_role text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['mg_messages','mg_friendships','mg_notifications','mg_movies','mg_users','mg_watches','mg_ratings','mg_comments','mg_favorites'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=format('public.%I',tab)::regclass AND tgname='mg_realtime_invalidate' AND NOT tgisinternal) THEN
      EXECUTE format('CREATE TRIGGER mg_realtime_invalidate AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.mg_realtime_changed()',tab);
    END IF;
  END LOOP;
  FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.mg_realtime_versions FROM %I',api_role);
      EXECUTE format('REVOKE ALL ON FUNCTION public.mg_realtime_changed() FROM %I',api_role);
    END IF;
  END LOOP;
END
$triggers$;

-- Reject NEW inline image writes even from older application instances/direct server SQL.
-- Legacy inline images may remain unchanged until the explicit Storage migration runs.
CREATE OR REPLACE FUNCTION mg_image_reference_only() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $image_reference$
DECLARE col text; current_value text; previous_value text;
BEGIN
  FOREACH col IN ARRAY TG_ARGV LOOP
    current_value := to_jsonb(NEW)->>col;
    previous_value := CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD)->>col END;
    IF current_value IS DISTINCT FROM previous_value AND current_value IS NOT NULL AND current_value<>'' THEN
      IF length(current_value)>4096 OR current_value ~ '[[:space:]]' OR position(E'\\' in current_value)>0
         OR (current_value !~* '^https?://' AND current_value !~ '^/[^/]') THEN
        RAISE EXCEPTION 'Image column % must contain an HTTP(S) URL or local path, not inline data. Upload to Storage first.', col USING ERRCODE='22023';
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END
$image_reference$;
REVOKE ALL ON FUNCTION mg_image_reference_only() FROM PUBLIC;
DO $image_triggers$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.mg_movies'::regclass AND tgname='mg_movie_image_urls') THEN
    CREATE TRIGGER mg_movie_image_urls BEFORE INSERT OR UPDATE OF poster,backdrop ON mg_movies FOR EACH ROW EXECUTE FUNCTION mg_image_reference_only('poster','backdrop');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.mg_users'::regclass AND tgname='mg_user_image_urls') THEN
    CREATE TRIGGER mg_user_image_urls BEFORE INSERT OR UPDATE OF avatar,header_image ON mg_users FOR EACH ROW EXECUTE FUNCTION mg_image_reference_only('avatar','header_image');
  END IF;
END
$image_triggers$;
