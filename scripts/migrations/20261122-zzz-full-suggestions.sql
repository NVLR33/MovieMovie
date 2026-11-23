-- Additive: old short proposals remain readable and can be completed by a curator.
ALTER TABLE mg_movie_suggestions ADD COLUMN IF NOT EXISTS material jsonb;
CREATE INDEX IF NOT EXISTS mg_suggestion_status_date ON mg_movie_suggestions(status, created_at);
CREATE INDEX IF NOT EXISTS mg_suggestion_user_status ON mg_movie_suggestions(user_id, status);
-- Suggestions and moderation history are private server-managed records.
ALTER TABLE mg_movie_suggestions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE mg_movie_suggestions FROM PUBLIC;
REVOKE ALL ON SEQUENCE mg_movie_suggestions_id_seq FROM PUBLIC;
DO $security$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE mg_movie_suggestions FROM %I',api_role);
      EXECUTE format('REVOKE ALL ON SEQUENCE mg_movie_suggestions_id_seq FROM %I',api_role);
    END IF;
  END LOOP;
END
$security$;
-- Deliver moderation changes to author/moderator shells without a manual reload.
CREATE OR REPLACE FUNCTION mg_suggestion_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $changed$
DECLARE target integer;
BEGIN
  IF TG_OP='UPDATE' AND to_jsonb(OLD)=to_jsonb(NEW) THEN RETURN NULL; END IF;
  FOR target IN
    SELECT DISTINCT id FROM (
      SELECT 0 AS id
      UNION ALL SELECT id FROM public.mg_users WHERE role IN ('admin','moderator')
      UNION ALL SELECT CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.user_id END
      UNION ALL SELECT CASE WHEN TG_OP='DELETE' THEN NULL ELSE NEW.user_id END
    ) audiences WHERE id IS NOT NULL ORDER BY id
  LOOP
    INSERT INTO public.mg_realtime_versions(audience_id,revision) VALUES(target,1)
    ON CONFLICT(audience_id) DO UPDATE SET revision=public.mg_realtime_versions.revision+1;
  END LOOP;
  RETURN NULL;
END
$changed$;
REVOKE ALL ON FUNCTION mg_suggestion_changed() FROM PUBLIC;
DO $trigger$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.mg_movie_suggestions'::regclass AND tgname='mg_realtime_invalidate' AND NOT tgisinternal) THEN
    CREATE TRIGGER mg_realtime_invalidate AFTER INSERT OR UPDATE OR DELETE ON mg_movie_suggestions
    FOR EACH ROW EXECUTE FUNCTION mg_suggestion_changed();
  END IF;
END
$trigger$;
