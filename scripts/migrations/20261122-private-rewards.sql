-- Rewards are written through the trusted Next.js server's PostgreSQL connection.
-- Do not allow Supabase's browser-facing Data API roles to forge or enumerate them.
ALTER TABLE mg_hidden_achievement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mg_hidden_achievement_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE mg_user_title_awards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE mg_hidden_achievement_events, mg_hidden_achievement_awards, mg_user_title_awards FROM PUBLIC;
REVOKE ALL ON SEQUENCE mg_hidden_achievement_events_id_seq, mg_hidden_achievement_awards_id_seq, mg_user_title_awards_id_seq FROM PUBLIC;
DO $reward_security$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE mg_hidden_achievement_events, mg_hidden_achievement_awards, mg_user_title_awards FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON SEQUENCE mg_hidden_achievement_events_id_seq, mg_hidden_achievement_awards_id_seq, mg_user_title_awards_id_seq FROM %I', api_role);
    END IF;
  END LOOP;
END
$reward_security$;
-- No client policies are created: the table owner/server migration role retains access.
