-- READ ONLY. Run in Supabase SQL Editor connected to the SAME project as the app.
-- Safe output: column readiness only. No accounts, passwords, tokens or database URLs.
-- This does not repair a schema or change sessions. If MISSING/WRONG_TYPE is shown,
-- back up the DB and apply scripts/supabase/01-upgrade.sql, then 02/03 verification.
WITH required_columns(column_name, expected_type) AS (
  VALUES ('id', 'integer'), ('email', 'text'), ('username', 'text'),
         ('password_hash', 'text'), ('provider', 'text'), ('provider_id', 'text'),
         ('telegram_id', 'text'), ('is_editor', 'boolean'),
         ('is_suspended', 'boolean'), ('suspension_reason', 'text'),
         ('session_version', 'integer')
)
SELECT 'auth_column:' || required.column_name AS check_name,
       CASE WHEN actual.column_name IS NULL THEN 'MISSING'
            WHEN actual.data_type <> required.expected_type THEN 'WRONG_TYPE'
            ELSE 'OK' END AS result
FROM required_columns required
LEFT JOIN information_schema.columns actual
  ON actual.table_schema = 'public' AND actual.table_name = 'mg_users'
 AND actual.column_name = required.column_name
ORDER BY required.column_name;
