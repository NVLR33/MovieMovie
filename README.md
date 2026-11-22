# MovieMovie

Next.js / React application with PostgreSQL (Drizzle) and optional Supabase Storage,
Telegram Login Widget and Yandex OAuth integrations.

## Development

Use Node.js 22 or later.

```sh
npm ci
cp .env.example .env
# Configure DATABASE_URL and SESSION_SECRET in .env.
npx tsx scripts/setup-db.ts
npm run dev -- --hostname 0.0.0.0
```

Schema setup uses `DATABASE_URL`, not a hard-coded local database. Review schema
changes before applying them to production. Automatic seed data is disabled.
Next.js reads `.env`; standalone scripts and Drizzle also load `.env` through dotenv.

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```

A reachable PostgreSQL instance with the schema applied is required to run the app.
Build requires a valid `DATABASE_URL` configuration; dynamically rendered pages do
not query the database during build. Fonts are bundled from Fontsource; no Google
Fonts network access is required for build or runtime.

## Deployment notes

- Set a random `SESSION_SECRET` of at least 32 characters. Production no longer
  accepts a database URL or a shared development secret as the signing key.
  Existing sessions signed with the old fallback will require a new login.
- Telegram login requires the server-side `TELEGRAM_BOT_TOKEN` belonging to the
  widget's bot, plus `NEXT_PUBLIC_TELEGRAM_BOT_NAME` for the widget. Unsigned, altered or more-than-24-hour-old data is rejected.
- Yandex callbacks require both a state cookie and a matching state parameter.
  Set `NEXT_PUBLIC_SITE_URL` to the deployed HTTPS origin and register
  `<origin>/api/oauth/yandex` with the provider.
- Storage requires `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and the
  public `uploads` bucket (`npx tsx scripts/setup-storage.ts`). Legacy service-role
  JWTs and modern Supabase secret keys are supported. Keep server keys private.
- Removing a watched mark now reverses its 35 XP reward; editing an existing
  rating does not grant additional XP. The unused `questComplete` action is
  disabled until quests and their rewards are validated on the server.

## Verification and remaining work

The regression suite covers Telegram signatures and freshness, OAuth state,
production session configuration and grouped rating calculations. It does not
replace end-to-end tests with real PostgreSQL and external auth/storage providers.

Known follow-up items from this review:

- The central `/api/data` response still loads global watch/rating/game history
  for leaderboards. It now indexes these collections in memory and scopes private
  queries, but larger installations should use SQL aggregates and pagination.
- Inbox history also needs SQL-side pagination/aggregation for large accounts.
  Individual conversations now return the **latest** 200 messages.
- Client-reported game results, repeated list votes and other reward-bearing
  actions need server-authoritative validation and abuse/rate limits.
- ESLint reports no errors and five warnings: three `no-img-element` warnings in
  share/wrapped components and two full-page navigation warnings. Export/canvas
  image handling and post-save state refresh should be checked before replacing
  them; OAuth redirects intentionally perform full-page navigation.
- `npm audit --omit=dev` is clean after updating Next.js. Full audit still reports
  moderate advisories in Drizzle Kit's legacy esbuild tooling; avoid exposing its
  development tooling to untrusted networks. Do not apply npm's suggested major
  downgrade automatically.
