-- Additive and idempotent. Apply before deploying event-time trophies.
CREATE TABLE IF NOT EXISTS mg_hidden_achievement_events (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES mg_users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  movie_id integer NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  time_zone text NOT NULL,
  week_key text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS mg_hidden_event_unique
  ON mg_hidden_achievement_events(user_id, kind, movie_id);
CREATE TABLE IF NOT EXISTS mg_hidden_achievement_awards (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES mg_users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  time_zone text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS mg_hidden_award_unique
  ON mg_hidden_achievement_awards(user_id, achievement_id);

CREATE INDEX IF NOT EXISTS mg_hidden_event_week
  ON mg_hidden_achievement_events(user_id, kind, week_key);
