-- Independent publication capability; existing roles are not silently promoted.
ALTER TABLE mg_users ADD COLUMN IF NOT EXISTS is_editor boolean NOT NULL DEFAULT false;
ALTER TABLE mg_users ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;
ALTER TABLE mg_users ADD COLUMN IF NOT EXISTS suspension_reason text;
ALTER TABLE mg_users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS mg_admin_audit (
  id serial PRIMARY KEY,
  actor_id integer NOT NULL REFERENCES mg_users(id),
  actor_name text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id integer,
  summary text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mg_admin_audit_actor_date ON mg_admin_audit(actor_id,created_at);
CREATE INDEX IF NOT EXISTS mg_admin_audit_action_date ON mg_admin_audit(action,created_at);
ALTER TABLE mg_admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE mg_admin_audit FROM PUBLIC;
REVOKE ALL ON SEQUENCE mg_admin_audit_id_seq FROM PUBLIC;
DO $security$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE mg_admin_audit FROM %I',api_role);
      EXECUTE format('REVOKE ALL ON SEQUENCE mg_admin_audit_id_seq FROM %I',api_role);
    END IF;
  END LOOP;
END
$security$;
