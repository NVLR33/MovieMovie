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

## Personal cinema cards

The profile's **Кино-визитка** studio offers three themes, 1080×1080 posts and
1080×1920 stories. Preview and PNG export use the same self-contained SVG artwork
with the original logo. Images are generated locally in the browser; no personal
image is uploaded and no external design service/API is required. Native sharing
sends a PNG where supported. Otherwise the PNG is downloaded for manual attachment.
Telegram/VK links share the public `/user/{id}` URL, not an automatically uploaded image.

Before deploying this feature, apply the additive cast migration to the configured
database (or review/apply the equivalent Drizzle schema change):

```sql
-- scripts/migrations/20261122-movie-cast.sql
ALTER TABLE mg_movies ADD COLUMN IF NOT EXISTS "cast" text NOT NULL DEFAULT '';
```

Administrators/moderators enter the cast in the movie editor, separated by commas,
semicolons or newlines. Existing titles are not assigned invented cast data.

Calculation rules:
- Top-three genres and the most-watched actor use watch sessions, including rewatches.
  Duplicate/case-varied names in a title count once. Ties sort alphabetically.
- Missing catalog titles are excluded. Missing casts do not produce a guessed actor;
  the card states the cast-data coverage, including partial coverage.
- Total minutes match the profile: duration × episodes for episodic titles.
- The crown is the earned achievement **tier** with the lowest community ownership
  percentage. Ties prefer a higher tier, then a stable achievement ID. Missing or
  inconsistent ownership statistics never produce a fake rare achievement.
- Cards contain only username and cinema statistics, not email, messages, or inbox data.
  PNGs are snapshots; they do not update after being shared.

## Event-time hidden trophies

Apply `scripts/migrations/20261122-hidden-achievements.sql` **before** deploying.
It adds an immutable first-watch event ledger and per-user trophy awards; it does
not backfill or reinterpret old watches/ratings. No new XP reward is granted.

- A new watched mark between 03:00 (inclusive) and 05:00 (exclusive), using server
  time converted into the browser's validated IANA timezone, earns **Ночной дозор**.
  Missing/invalid timezones fall back to UTC. Client-provided dates/hours are ignored.
- A new/change-to-10 rating earns **Против течения** when at least one *other* user
  has voted and their unrounded mean is strictly below 4. The caller's previous vote
  is excluded. User/movie row locks serialize the pre-update snapshot.
- Seven distinct first-recorded watched materials in one local calendar week
  (Monday–Sunday) earn **Стабильность**. All catalog categories qualify. Repeated
  requests and unwatch/watch toggles do not create extra events, even in later weeks.
- Awards and one inbox notification are inserted atomically with the action.
  Unique indexes prevent duplicate awards/notifications. Removing a watch, changing
  a rating or deleting a film does not revoke awards. Deleting the user cascades them.
- Locked definitions remain on the server: no placeholders, secret totals or locked
  conditions are sent to the client. `/api/data` serializes only the caller's earned
  trophies, with real ownership percentages among all registered users.
- Earned secrets appear in achievements/profile counts and can become a cinema-card
  crown. No locked secret can leak through the card generator.

## Earned custom titles and spoiler reviews

Apply `scripts/migrations/20261122-custom-titles.sql` before deploying. It adds the
selected title, permanent title awards, editorial franchise/festival metadata, and
comment spoiler flags. It also backfills qualifying viewer ranks from existing
unique watched materials without removing old titles or changing usernames.

- The profile's **Коллекция титулов** offers explicit selection, automatic mode,
  or no title. The original 0/5/15/30 ranks keep their names; ranks at 100/250/500
  extend progression. Unique materials count, not repeat watch requests.
- **Адвокат Marvel** requires 10/10 on every `Фильм` whose editorial franchise
  is exactly `Marvel` (case insensitive, whitespace trimmed), with at least three
  such films in the catalog. Other categories, studios and title keywords do not count.
- **Король артхауса** requires 50 different watched `Фильм` entries with the
  editorial `festival_recognized` flag. This is a curated classification, not an
  invented festival rating. Editors must fill metadata from actual information.
- **Серийный спойлерщик** requires spoiler-tagged top-level reviews of at least
  80 Unicode characters on 10 distinct materials. Short replies, duplicates and
  deleted catalog materials do not advance the current count. Authors can mark
  their own reviews; only moderators/admins can retag someone else's comment.
- Qualifying watch/rating/review actions persist title unlocks in their transaction.
  Existing-history or newly curated eligibility is shown as **Условие выполнено**
  until the next qualifying action or explicit selection records it permanently.
  Earned titles remain selectable after ratings, catalog entries or reviews change.
- `/api/action` validates the choice against server-calculated eligibility or a
  permanent award; arbitrary text and locked IDs are rejected. It does not change
  roles, grant XP, or trust client-supplied progress.
- Comments and public profiles receive the resolved display title. Spoiler bodies
  stay out of the rendered comment DOM until revealed; this is a reading preference,
  not an access-control mechanism (the API still delivers comment text).

## Supabase migration automation

See [the Russian deployment guide](scripts/supabase/README.md) for ready-to-run SQL
Editor files, a checksum-tracked transactional CLI, and the manually triggered
**Apply Supabase migrations** GitHub Actions workflow. Start with a database backup;
apply schema changes before deploying the updated app. Nothing runs on ordinary pushes.

```sh
npm run db:bundle                 # regenerate the single SQL Editor upgrade
npm run db:migrate -- --dry-run    # local inventory, no database connection
npm run db:status                 # read-only remote status
npm run db:migrate                # apply pending migrations using a server-only URL
```
