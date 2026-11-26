-- References only: MovieMovie never fetches, stores or proxies the video stream.
ALTER TABLE public.mg_movies ADD COLUMN IF NOT EXISTS playback_url text NOT NULL DEFAULT '';
ALTER TABLE public.mg_series_episodes ADD COLUMN IF NOT EXISTS playback_url text NOT NULL DEFAULT '';
