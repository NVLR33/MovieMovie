-- Add structured seasons/episodes. Existing catalog counts are NOT guessed into episodes.
ALTER TABLE mg_movies ADD COLUMN IF NOT EXISTS series_catalog_complete boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS mg_series_seasons (
  id serial PRIMARY KEY,
  movie_id integer NOT NULL REFERENCES mg_movies(id) ON DELETE CASCADE,
  number integer NOT NULL CONSTRAINT mg_season_number_valid CHECK(number BETWEEN 1 AND 100),
  title text NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS mg_season_number_unique ON mg_series_seasons(movie_id, number);
CREATE TABLE IF NOT EXISTS mg_series_episodes (
  id serial PRIMARY KEY,
  season_id integer NOT NULL REFERENCES mg_series_seasons(id) ON DELETE CASCADE,
  number integer NOT NULL CONSTRAINT mg_episode_number_valid CHECK(number BETWEEN 1 AND 100),
  title text NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS mg_episode_number_unique ON mg_series_episodes(season_id, number);
CREATE TABLE IF NOT EXISTS mg_season_ratings (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES mg_users(id) ON DELETE CASCADE,
  season_id integer NOT NULL REFERENCES mg_series_seasons(id) ON DELETE CASCADE,
  value real NOT NULL CONSTRAINT mg_season_rating_valid CHECK(value BETWEEN 0.5 AND 10 AND value * 2 = floor(value * 2))
);
CREATE UNIQUE INDEX IF NOT EXISTS mg_season_rating_unique ON mg_season_ratings(user_id, season_id);
CREATE TABLE IF NOT EXISTS mg_episode_ratings (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES mg_users(id) ON DELETE CASCADE,
  episode_id integer NOT NULL REFERENCES mg_series_episodes(id) ON DELETE CASCADE,
  value real NOT NULL CONSTRAINT mg_episode_rating_valid CHECK(value BETWEEN 0.5 AND 10 AND value * 2 = floor(value * 2))
);
CREATE UNIQUE INDEX IF NOT EXISTS mg_episode_rating_unique ON mg_episode_ratings(user_id, episode_id);
CREATE TABLE IF NOT EXISTS mg_series_completions (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES mg_users(id) ON DELETE CASCADE,
  movie_id integer NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mg_series_completion_unique ON mg_series_completions(user_id, movie_id);
CREATE TABLE IF NOT EXISTS mg_movie_pioneers (
  movie_id integer PRIMARY KEY,
  user_id integer REFERENCES mg_users(id) ON DELETE SET NULL,
  first_watched_at timestamptz NOT NULL DEFAULT now(),
  rated boolean NOT NULL DEFAULT false,
  reviewed boolean NOT NULL DEFAULT false
);
-- Past activity cannot prove who first watched a title and later removed it.
-- Block already watched titles; do not fabricate retrospective pioneer awards.
INSERT INTO mg_movie_pioneers(movie_id)
SELECT movie_id FROM mg_watches
UNION SELECT movie_id FROM mg_hidden_achievement_events WHERE kind = 'watch'
ON CONFLICT (movie_id) DO NOTHING;

ALTER TABLE mg_series_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE mg_series_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mg_season_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mg_episode_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mg_series_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mg_movie_pioneers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE mg_series_seasons, mg_series_episodes, mg_season_ratings, mg_episode_ratings, mg_series_completions, mg_movie_pioneers FROM PUBLIC;
REVOKE ALL ON SEQUENCE mg_series_seasons_id_seq, mg_series_episodes_id_seq, mg_season_ratings_id_seq, mg_episode_ratings_id_seq, mg_series_completions_id_seq FROM PUBLIC;
DO $series_security$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE mg_series_seasons, mg_series_episodes, mg_season_ratings, mg_episode_ratings, mg_series_completions, mg_movie_pioneers FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON SEQUENCE mg_series_seasons_id_seq, mg_series_episodes_id_seq, mg_season_ratings_id_seq, mg_episode_ratings_id_seq, mg_series_completions_id_seq FROM %I', api_role);
    END IF;
  END LOOP;
END
$series_security$;
