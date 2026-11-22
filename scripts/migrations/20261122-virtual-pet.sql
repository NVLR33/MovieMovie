-- Separate, non-monetary pet economy. No changes to user XP or historical rewards.
CREATE TABLE IF NOT EXISTS mg_cinema_pets (
  user_id integer PRIMARY KEY REFERENCES mg_users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Поппи' CONSTRAINT mg_pet_name_valid CHECK(char_length(name) BETWEEN 1 AND 24),
  balance integer NOT NULL DEFAULT 0 CONSTRAINT mg_pet_balance_valid CHECK(balance >= 0),
  experience integer NOT NULL DEFAULT 0 CONSTRAINT mg_pet_experience_valid CHECK(experience >= 0),
  branch text NOT NULL DEFAULT 'director' CONSTRAINT mg_pet_branch_valid CHECK(branch IN ('director','monster')),
  theme text NOT NULL DEFAULT 'classic',
  accessory text NOT NULL DEFAULT 'none',
  owned_items text NOT NULL DEFAULT '[]',
  projector_level integer NOT NULL DEFAULT 0 CONSTRAINT mg_pet_projector_valid CHECK(projector_level BETWEEN 0 AND 5),
  archive_level integer NOT NULL DEFAULT 0 CONSTRAINT mg_pet_archive_valid CHECK(archive_level BETWEEN 0 AND 3),
  show_in_profile boolean NOT NULL DEFAULT true,
  adopted_at timestamptz,
  last_collected_at timestamptz
);
CREATE TABLE IF NOT EXISTS mg_popcorn_ledger (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES mg_users(id) ON DELETE CASCADE,
  source_key text NOT NULL,
  kind text NOT NULL,
  delta integer NOT NULL,
  experience_delta integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mg_popcorn_source_unique ON mg_popcorn_ledger(user_id,source_key);
CREATE INDEX IF NOT EXISTS mg_popcorn_user_day ON mg_popcorn_ledger(user_id,created_at);
-- Remember old actions without retroactive currency. Unwatch/re-watch, edits and re-deploys
-- cannot turn historical activity into new income. These rows are not daily mission progress.
INSERT INTO mg_popcorn_ledger(user_id,source_key,kind,delta)
SELECT user_id, 'watch:' || movie_id, 'baseline', 0 FROM mg_watches
UNION SELECT user_id, 'watch:' || movie_id, 'baseline', 0 FROM mg_hidden_achievement_events WHERE kind='watch'
UNION SELECT user_id, 'rate:' || movie_id, 'baseline', 0 FROM mg_ratings
UNION SELECT user_id, 'review:' || movie_id, 'baseline', 0 FROM mg_comments WHERE parent_id IS NULL AND char_length(btrim(body)) >= 80
UNION SELECT user_id, 'catalog:' || movie_id, 'baseline', 0 FROM mg_movie_suggestions WHERE status='approved' AND movie_id IS NOT NULL
ON CONFLICT (user_id,source_key) DO NOTHING;
ALTER TABLE mg_cinema_pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mg_popcorn_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE mg_cinema_pets,mg_popcorn_ledger FROM PUBLIC;
REVOKE ALL ON SEQUENCE mg_popcorn_ledger_id_seq FROM PUBLIC;
DO $pet_security$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE mg_cinema_pets,mg_popcorn_ledger FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON SEQUENCE mg_popcorn_ledger_id_seq FROM %I', api_role);
    END IF;
  END LOOP;
END
$pet_security$;
