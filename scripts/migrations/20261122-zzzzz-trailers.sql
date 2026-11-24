-- Additive only. Videos stay in object storage; this field stores a reference.
ALTER TABLE public.mg_movies ADD COLUMN IF NOT EXISTS trailer_url text NOT NULL DEFAULT '';
