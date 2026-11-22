-- Apply before deploying cinema cards. Additive/idempotent; no catalog rows are removed.
ALTER TABLE mg_movies ADD COLUMN IF NOT EXISTS "cast" text NOT NULL DEFAULT '';
