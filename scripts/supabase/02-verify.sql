-- Read-only readiness checks. Run AFTER 01-upgrade.sql. Every row should say OK.
-- This does not display passwords, emails, comments or personal watch history.
WITH checks(name, ok) AS (
  VALUES
    ('Image URL guard triggers installed', (SELECT count(*)=2 AND bool_and(t.tgenabled<>'D') FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND ((c.relname='mg_movies' AND t.tgname='mg_movie_image_urls') OR (c.relname='mg_users' AND t.tgname='mg_user_image_urls')))),
    ('Realtime revision table RLS', EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='mg_realtime_versions' AND c.relrowsecurity)),
    ('Realtime triggers installed', (SELECT count(*)=9 AND bool_and(t.tgenabled<>'D') FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND t.tgname='mg_realtime_invalidate' AND c.relname IN ('mg_messages','mg_friendships','mg_notifications','mg_movies','mg_users','mg_watches','mg_ratings','mg_comments','mg_favorites'))),
    ('No browser realtime table grants', NOT EXISTS(SELECT 1 FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE r.rolname IN ('anon','authenticated') AND n.nspname='public' AND c.relname='mg_realtime_versions' AND has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE'))),
    ('Fractional projector wallet upgrade', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mg_cinema_pets' AND column_name='production_carry') AND EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.mg_cinema_pets') AND conname='mg_pet_carry_valid')),
    ('Cinema pet and popcorn ledger', to_regclass('public.mg_cinema_pets') IS NOT NULL AND to_regclass('public.mg_popcorn_ledger') IS NOT NULL),
    ('Pet economy duplicate protection', (SELECT count(*)=2 FROM pg_indexes WHERE schemaname='public' AND indexname IN ('mg_cinema_pets_pkey','mg_popcorn_source_unique'))),
    ('Pet tables have RLS', (SELECT count(*)=2 AND bool_and(c.relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('mg_cinema_pets','mg_popcorn_ledger'))),
    ('No browser API pet grants', NOT EXISTS(SELECT 1 FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE r.rolname IN ('anon','authenticated') AND n.nspname='public' AND c.relname IN ('mg_cinema_pets','mg_popcorn_ledger') AND has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE'))),
    ('No browser API pet sequence grants', NOT EXISTS(SELECT 1 FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE r.rolname IN ('anon','authenticated') AND n.nspname='public' AND c.relkind='S' AND c.relname IN ('mg_popcorn_ledger_id_seq') AND has_sequence_privilege(r.oid,c.oid,'USAGE,SELECT,UPDATE'))),
    ('Structured series catalog', to_regclass('public.mg_series_seasons') IS NOT NULL AND to_regclass('public.mg_series_episodes') IS NOT NULL),
    ('Season and episode ratings', to_regclass('public.mg_season_ratings') IS NOT NULL AND to_regclass('public.mg_episode_ratings') IS NOT NULL),
    ('Permanent series completions', to_regclass('public.mg_series_completions') IS NOT NULL),
    ('Immutable first viewer ledger', to_regclass('public.mg_movie_pioneers') IS NOT NULL),
    ('Series catalog confirmation', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mg_movies' AND column_name='series_catalog_complete')),
    ('Series tables have RLS', (SELECT count(*)=6 AND bool_and(c.relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('mg_series_seasons','mg_series_episodes','mg_season_ratings','mg_episode_ratings','mg_series_completions','mg_movie_pioneers'))),
    ('No browser API series grants', NOT EXISTS(SELECT 1 FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE r.rolname IN ('anon','authenticated') AND n.nspname='public' AND c.relname IN ('mg_series_seasons','mg_series_episodes','mg_season_ratings','mg_episode_ratings','mg_series_completions','mg_movie_pioneers') AND has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE'))),
    ('No browser API series sequence grants', NOT EXISTS(SELECT 1 FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE r.rolname IN ('anon','authenticated') AND n.nspname='public' AND c.relkind='S' AND c.relname IN ('mg_series_seasons_id_seq','mg_series_episodes_id_seq','mg_season_ratings_id_seq','mg_episode_ratings_id_seq','mg_series_completions_id_seq') AND has_sequence_privilege(r.oid,c.oid,'USAGE,SELECT,UPDATE'))),
    ('Movie cast column', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mg_movies' AND column_name='cast')),
    ('Franchise column', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mg_movies' AND column_name='franchise')),
    ('Festival classification', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mg_movies' AND column_name='festival_recognized')),
    ('Comment spoiler flags', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mg_comments' AND column_name='spoiler')),
    ('Selected user title', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mg_users' AND column_name='equipped_title')),
    ('Hidden event ledger', to_regclass('public.mg_hidden_achievement_events') IS NOT NULL),
    ('Hidden award ledger', to_regclass('public.mg_hidden_achievement_awards') IS NOT NULL),
    ('Permanent title ledger', to_regclass('public.mg_user_title_awards') IS NOT NULL),
    ('Migration history', to_regclass('moviemovie_migrations.history') IS NOT NULL),
    ('Duplicate protection indexes', (SELECT count(*)=3 FROM pg_indexes WHERE schemaname='public' AND indexname IN ('mg_hidden_event_unique','mg_hidden_award_unique','mg_user_title_unique'))),
    ('Weekly event lookup index', EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='mg_hidden_event_week')),
    ('Reward tables have RLS', (SELECT count(*)=3 AND bool_and(c.relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('mg_hidden_achievement_events','mg_hidden_achievement_awards','mg_user_title_awards'))),
    ('No browser API table grants', NOT EXISTS(SELECT 1 FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE r.rolname IN ('anon','authenticated') AND n.nspname='public' AND c.relname IN ('mg_hidden_achievement_events','mg_hidden_achievement_awards','mg_user_title_awards') AND has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE'))),
    ('No browser API sequence grants', NOT EXISTS(SELECT 1 FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE r.rolname IN ('anon','authenticated') AND n.nspname='public' AND c.relkind='S' AND c.relname IN ('mg_hidden_achievement_events_id_seq','mg_hidden_achievement_awards_id_seq','mg_user_title_awards_id_seq') AND has_sequence_privilege(r.oid,c.oid,'USAGE,SELECT,UPDATE')))
)
SELECT name AS check_name, CASE WHEN ok IS TRUE THEN 'OK' ELSE 'NEEDS ATTENTION' END AS result FROM checks ORDER BY name;
