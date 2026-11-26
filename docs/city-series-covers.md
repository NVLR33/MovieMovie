# City discovery, episodic covers and own-profile hover repair

## Scope

Targeted additions; existing site composition, navigation, home podium and material view choices remain intact. No migration, production connection, deployment, external geocoder or showtime API is introduced.

- Own-profile statistics tabs wrap instead of becoming a tightly clipped horizontal scroller. Scoped padding leaves room for outlines; hover/focus does not translate tabs. Existing public-profile responsive repairs remain separate.
- Shared `MaterialCover` (with `TrailerSurface` for previews) uses the same standard full-bleed cover for episodic categories and feature films, without backing sheets or an episode banner over the artwork. Applied to catalog, home five, weekly pulse, collections, world and detail posters. Feature films are not decorated. Existing muted hover previews retain their lifecycle/reduced-motion behavior.
- `getOverview` batches catalog season counts in one grouped query (not a query per poster). A missing count is not replaced with an assumed season. Episode numbers come from declared material metadata. Season entries remain available in detail navigation; episode counts remain in card metadata rather than covering the artwork.

## City choice and privacy

`city-location.ts` contains validation, an intentionally small offline Russian city index and fixed-origin outbound search URLs. Manual cities are not restricted to that index. Nearby lookup rejects poor accuracy and distant matches; even a valid suggestion requires Apply.

`city-cinema.tsx` uses a browser-only shared store. No city is inferred automatically from IP or coordinates. `getCurrentPosition` runs only on the explicit location button; no watchPosition/background tracking is used. Coordinates are never stored or submitted to the MovieMovie backend. Browser/OS location resolution itself is governed by the user's browser.

By default the applied city lasts until page reload. Remember is opt-in, storing only `{city}` under `mg_city_v1`; no coordinates or identity are stored. Clear city invalidates pending callbacks and clears the stored city value. Storage failures fall back to the current page. Browser storage events keep remembered preferences synchronized between tabs.

City UI is available in settings and in collapsed panels on home/catalog. A chosen city enables an outbound title-specific search on non-episodic detail pages. Links open a fixed `https://yandex.ru/search/` origin with encoded text and without a referrer. Opening the search deliberately discloses the city/title query to that external service.

**This is cinema discovery, not a live schedule integration.** No availability, session times, ticket inventory or prices are fabricated. UI explicitly asks users to verify dates and availability at the external source. An in-app schedule requires a separately selected provider, credentials/terms as applicable, regional coverage and caching/error handling.

## Current material-card treatment

Films, series, anime series and animated series use the same standard full-bleed cover. The former episodic stack, reserved 12px space and sheet-specific badge offsets have been removed from the shared surface. Season metadata and navigation remain available, and episode counts stay in text below posters. Automatic native season-summary tooltips no longer obscure neighboring covers.

Age chips share the score's neutral charcoal background, with classification-colored text and a matching thin outline: 0–6 green, 7–12 blue, 13–15 yellow, 16–17 orange, 18–21 red; invalid/missing values remain neutral. Favorite hearts retain their selected state, accessible label and keyboard actions.

The new “premiere frame” hover resolves into a crisp inner rim and a broad, soft halo in the material's rating color. No poster zoom, image filtering, moving sheen, cursor-following light, tilt or card lift is used. The same treatment is applied to catalog cards, home top-five, showcases, weekly pulse and world results. Keyboard focus receives the frame too; reduced motion removes its transition, and forced-colors uses a visible system outline. Touch does not activate the desktop hover effect. Muted dwell-only trailer previews are unchanged.

Legacy seasonal hover rules previously replaced the rating glow with a seasonal shadow, and disabling seasonal glow suppressed card shadows entirely. The material-card layer now wins the former cascade; the seasonal-glow switch no longer disables this unrelated interaction feedback.

Validation: 264 unit tests, typecheck, lint and production build pass. City/series, material design, ranking library, weekly pulse and showcase production-browser suites pass against the isolated fixture database. Browser regressions assert standard full-bleed geometry, badge isolation across three densities/five widths/two themes, retained metadata and age colors, stationary/unfiltered artwork, absence of old effects, keyboard focus, reduced motion, and a visible halo with seasonal glow disabled. No production deployment or database migration was performed.

## Shared covers across the site

`material-cover.tsx` and the final `material-cover.css` layer now own the catalog-style cover: 2:3 proportions, full-bleed crop, 2px rating-colored frame, neutral score chip at the upper left, and classification-colored age chip at the lower left. Catalog cards keep their one outer perimeter rather than gaining a duplicate poster border. All surfaces share error handling and the stationary rating halo; no missing artwork is replaced by an unrelated movie's poster.

Migrated surfaces include catalog and profile grids, home top-five, full rankings, weekly pulse, studio/actor/genre and collaborative collections, world results, material detail, roulette, profile passport and memories, search/chat/history/comparison/watchroom thumbnails, submission/editor/admin previews, time capsule and wrapped artwork. Decorative panorama backdrops, avatars, branding and exported share images are not material-poster cards and retain their purpose-specific treatment.

The layout of sections, ranking numbers/metrics, navigation, favorites/watchlist actions, personal diary ratings and trailer lifecycle are preserved. Home ranking metrics remain in the caption when they are not the audience rating; weekly place numbers stay in the information block, leaving catalog-aligned score/age corners clear. Very small covers (under 80px of inner width) hide overlay chips instead of rendering illegible text. Tiny list thumbnails and decorative/game covers explicitly omit chips; the common frame and fallback remain. No additional network requests are made for metadata absent from a surface's existing data.

`material-cover-contract.mjs` checks common geometry, border ownership, image fill, chip placement/background and lack of nested navigation in realistic browser fixtures. The production 23-route smoke also runs this contract across rendered covers. The UI fixture loads the same final cover CSS and checks that the retired tilt/gloss never returns; reduced-motion epsilon durations from the global accessibility rule are treated as effectively immediate.

Additional validation passed: ranking, weekly pulse, collection, passport, memory orbit, roulette, public-profile, admin, suggestions, mobile and actual-app UI suites. A public-profile legacy 42px thumbnail-height override was found by the shared contract and corrected to the common 2:3 ratio.

## Original validation

- `npm test`: 249 tests pass, including city validation, nearby bounds, outbound URL encoding and truthful episodic labels.
- `npm run typecheck`, `npm run lint`, isolated `npm run build` pass (three existing next/no-img-element warnings).
- `npm run test:city-series:browser`: marker-guarded disposable database + production app; real grouped season counts; serial vs film; overlay geometry in three views, five widths, two themes; manual/session/remembered selection; explicit geolocation only; confirmation and denied permission; no external requests on render; settings/detail integration; own-profile tab hover/focus clipping.
- Existing profiles, material design, mobile and UI production-browser suites also pass after these changes.

Browser tests require `AUDIT_DATABASE_URL=postgresql://postgres:postgres@localhost/app_db?host=/tmp/mm-audit-pg`, the isolated fixture marker, and optional `UI_TEST_DEPS` pointing to a package with playwright-core/@sparticuz/chromium. The new suite is wired into the existing isolated quality workflow.
