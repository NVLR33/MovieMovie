# Frame: the moviemovie visual refresh

## Direction

A single system combining cinematic imagery, editorial typography and bento-style surfaces. The default palette is cool graphite with a pale mint accent; light, pink, purple and yellow remain fully supported. Theme, season and ambient-canvas preferences continue to use the existing settings and persistence.

Optical glass is reserved for the sidebar, sticky header and the hero's small overlay label. Content panels are opaque for legibility and lower GPU cost. Navigation uses static edge highlights and restrained blur, not cursor-following reflections, distortion filters or additional rendering libraries. On mobile, with reduced-transparency preferences, or without backdrop-filter support, navigation has an opaque fallback.

## What changes

- Shared colors, typography, panel edges/radii, headings, controls, focus rings and hover feedback throughout the app. Feature layouts and semantics remain feature-owned.
- Catalog filters, collection surfaces, ranking rows, profile widgets, games, achievements, challenges, people, showtimes, material-page panels, administrative panels and empty states use the shared vocabulary where appropriate.
- Locally bundled Golos replaces the old heavy heading/card mix. The legacy global `FONT FIX` declares variables on `body`; the refresh intentionally updates that same inheritance boundary, including body-mounted dialogs.
- The homepage has an editorial introduction and a responsive two-part stage: existing featured title/statistics plus the new mood console. Below 1201px the stage stacks, and the console itself becomes a compact two-column block before returning to a single column on phones.
- Long featured titles are visually clamped to three lines without changing their accessible text or detail-page title. Removed the static `01 / 05` carousel implication: the featured title is not a five-slide carousel.
- An empty catalog now has a useful homepage state instead of returning an empty fragment.

Original brand artwork and lowercase name are unchanged. Uniform poster geometry, rating tones and halos, colored wishlist/favorite states, uploaded/URL trailers, existing playback, purchased profile decoration, daily-tag behavior, permissions, city selection, settings/account dialogs and mobile navigation are preserved. No poster zoom, tilt or cursor gloss is added.

## Mood console

`EveningDiscovery` is a local, deterministic catalog browser, not a personalized/AI recommender:

- Four mood choices reuse `matchesCatalogMood`: editorial labels take precedence; otherwise the existing catalog genre fallback applies. Counts and results use the same predicate.
- Results are ordered by rating, vote count and ID; the catalog array is not mutated.
- Another-story cycles within the matching pool. Changing/resetting a mood resets the cursor. One result disables cycling; no matches produce an explicit empty state, never unrelated fallback films.
- Catalog continuation is a real `/catalog?mood=...` link; title preview opens a real movie link. Modified clicks retain native browser behavior.
- Pressed states, visible focus, native keyboard activation, live result count and reset are provided. There are no score, watch, rating, XP, account or storage mutations and no new API requests.
- The small text transition is keyed to the current title and disabled under reduced motion. Arrow feedback does not move cards or click targets. No animation loops are introduced.

Files: `src/components/visual-system.css` (loaded last), `src/components/evening-discovery.tsx`, `src/lib/evening-discovery.ts`, homepage integration in `movie-go-app.tsx`.

## Verification

- `npm test`: **296 passed**. New unit checks cover catalog-rule parity, editorial priority, deterministic non-mutating ordering, empty pools and valid catalog URLs.
- Production build, typecheck and `git diff --check`: **PASS**.
- ESLint: **0 errors**, two pre-existing image warnings in share components.
- `test:frame:browser`: **PASS**. Actual production app with intercepted read-only catalog data; requires only the two baseline titles from `serve-audit-db.mjs`. Tests matching/counts, cycling, single/empty results, keyboard and real route navigation, five themes × six home widths, ten routes × two themes × two widths, typography, reduced motion, forced colors and no action writes. `/api/pulse` is also intercepted so SSE refresh cannot replace the controlled catalog. Screenshots default to `/tmp/mm-frame-screenshots`, outside Git.
- Regression suites **PASS**: `test:shell:browser`, `test:design:browser`, `test:detail:browser`, `test:account:browser`, `test:settings:browser`, `test:mobile:browser`, `test:brand:browser`, `test:community:browser`, `test:catalog:browser`, and `test:ui`.
- The actual-app responsive fixture includes the new stylesheet. New browser suite is included in the existing isolated CI workflow.

All database-backed regression tests used the isolated local database. No dependencies, schema changes, migrations, production database writes or deployments.
