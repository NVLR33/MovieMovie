-- Read-only readiness checks. Run AFTER 01-upgrade.sql. Every row should say OK.
-- This does not display passwords, emails, comments or personal watch history.
WITH checks(name, ok) AS (
  VALUES
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
