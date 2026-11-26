# City discovery, episodic covers and own-profile hover repair

## Scope

Targeted additions; existing site composition, navigation, home podium and material view choices remain intact. No migration, production connection, deployment, external geocoder or showtime API is introduced.

- Own-profile statistics tabs wrap instead of becoming a tightly clipped horizontal scroller. Scoped padding leaves room for outlines; hover/focus does not translate tabs. Existing public-profile responsive repairs remain separate.
- Shared `TrailerSurface` decorates episodic categories with two static backing sheets and a metadata caption. Applied to catalog, home five, weekly pulse, collections, world and detail posters. Feature films are not decorated. Existing muted hover previews retain their lifecycle/reduced-motion behavior.
- `getOverview` batches catalog season counts in one grouped query (not a query per poster). A missing count is not replaced with an assumed season. Episode numbers come from declared material metadata. Caption descriptions distinguish catalog season entries from complete catalog metadata; they do not claim a verified complete release history.

## City choice and privacy

`city-location.ts` contains validation, an intentionally small offline Russian city index and fixed-origin outbound search URLs. Manual cities are not restricted to that index. Nearby lookup rejects poor accuracy and distant matches; even a valid suggestion requires Apply.

`city-cinema.tsx` uses a browser-only shared store. No city is inferred automatically from IP or coordinates. `getCurrentPosition` runs only on the explicit location button; no watchPosition/background tracking is used. Coordinates are never stored or submitted to the MovieMovie backend. Browser/OS location resolution itself is governed by the user's browser.

By default the applied city lasts until page reload. Remember is opt-in, storing only `{city}` under `mg_city_v1`; no coordinates or identity are stored. Clear city invalidates pending callbacks and clears the stored city value. Storage failures fall back to the current page. Browser storage events keep remembered preferences synchronized between tabs.

City UI is available in settings and in collapsed panels on home/catalog. A chosen city enables an outbound title-specific search on non-episodic detail pages. Links open a fixed `https://yandex.ru/search/` origin with encoded text and without a referrer. Opening the search deliberately discloses the city/title query to that external service.

**This is cinema discovery, not a live schedule integration.** No availability, session times, ticket inventory or prices are fabricated. UI explicitly asks users to verify dates and availability at the external source. An in-app schedule requires a separately selected provider, credentials/terms as applicable, regional coverage and caching/error handling.

## Validation

- `npm test`: 249 tests pass, including city validation, nearby bounds, outbound URL encoding and truthful episodic labels.
- `npm run typecheck`, `npm run lint`, isolated `npm run build` pass (three existing next/no-img-element warnings).
- `npm run test:city-series:browser`: marker-guarded disposable database + production app; real grouped season counts; serial vs film; overlay geometry in three views, five widths, two themes; manual/session/remembered selection; explicit geolocation only; confirmation and denied permission; no external requests on render; settings/detail integration; own-profile tab hover/focus clipping.
- Existing profiles, material design, mobile and UI production-browser suites also pass after these changes.

Browser tests require `AUDIT_DATABASE_URL=postgresql://postgres:postgres@localhost/app_db?host=/tmp/mm-audit-pg`, the isolated fixture marker, and optional `UI_TEST_DEPS` pointing to a package with playwright-core/@sparticuz/chromium. The new suite is wired into the existing isolated quality workflow.
