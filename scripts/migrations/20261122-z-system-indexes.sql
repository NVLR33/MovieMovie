-- Query-supporting indexes for existing systems. No row/price/XP changes or deduplication.
-- Ordinary CREATE INDEX keeps the whole migration batch transactional. On large databases,
-- schedule a maintenance window; the runner's lock/statement timeouts fail closed.
CREATE INDEX IF NOT EXISTS mg_watch_user_movie ON mg_watches(user_id,movie_id);
CREATE INDEX IF NOT EXISTS mg_watch_user_date ON mg_watches(user_id,watched_at);
CREATE INDEX IF NOT EXISTS mg_watch_movie ON mg_watches(movie_id);
CREATE INDEX IF NOT EXISTS mg_rating_movie_value ON mg_ratings(movie_id,value);
CREATE INDEX IF NOT EXISTS mg_comment_movie_date ON mg_comments(movie_id,created_at);
CREATE INDEX IF NOT EXISTS mg_notification_user_date ON mg_notifications(user_id,created_at);
CREATE INDEX IF NOT EXISTS mg_message_pair_date ON mg_messages(from_id,to_id,created_at);
CREATE INDEX IF NOT EXISTS mg_popcorn_user_history ON mg_popcorn_ledger(user_id,id);
