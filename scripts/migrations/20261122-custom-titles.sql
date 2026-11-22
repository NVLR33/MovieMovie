-- Apply before deployment. No existing titles, comments or movies are deleted.
ALTER TABLE mg_users ADD COLUMN IF NOT EXISTS equipped_title text;
ALTER TABLE mg_movies ADD COLUMN IF NOT EXISTS franchise text NOT NULL DEFAULT '';
ALTER TABLE mg_movies ADD COLUMN IF NOT EXISTS festival_recognized boolean NOT NULL DEFAULT false;
ALTER TABLE mg_comments ADD COLUMN IF NOT EXISTS spoiler boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS mg_user_title_awards (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES mg_users(id) ON DELETE CASCADE,
  title_id text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mg_user_title_unique ON mg_user_title_awards(user_id,title_id);

-- Preserve all qualifying viewer ranks for the current library/history at rollout.
INSERT INTO mg_user_title_awards(user_id,title_id)
SELECT u.id, ranks.title_id FROM mg_users u
CROSS JOIN (VALUES
  ('beginner',0),('seeker',5),('frame_master',15),('screen_legend',30),
  ('connoisseur',100),('archivist',250),('universe_keeper',500)
) AS ranks(title_id,required)
WHERE (SELECT count(DISTINCT w.movie_id) FROM mg_watches w
       INNER JOIN mg_movies m ON m.id=w.movie_id WHERE w.user_id=u.id) >= ranks.required
ON CONFLICT(user_id,title_id) DO NOTHING;
