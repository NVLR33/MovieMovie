# Discovery journeys: world atlas and local showtimes

## Scope

A visual redesign of the existing `/world` and `/showtimes` routes, with shared destination navigation. Discovery remains separate from the homepage's primary cinema feed. No new personalization, widget arrangement or production data is introduced.

### Cinema atlas

- Editorial introduction and real selection/viewing counts; a large central map paired with a country-selection rail.
- Existing local Natural Earth geometry, fixed density bins, country parsing, co-production rules, personal viewing map, category/unseen filters, country search/selector, keyboard navigation, zoom/reset, regional sorting and twelve-at-a-time pagination remain available.
- Destination buttons list countries with the most titles **in the current selection**. They are not worldwide coverage estimates, recommendations or invented travel achievements. Counts come from the existing country index; ties use ISO code order.
- Production country is metadata, not an inference from language, genre or cultural identity. Historical/unknown country names are not silently reassigned. Unmapped titles remain selectable, including via `/world?country=unknown`; small territories remain available in the full selector.
- Existing quick-view navigation is retained, so closing a material preview does not discard the atlas filters, selected country or expanded result set.
- Density legend, map-reading explanation, metadata caveats and geographic attribution remain present. Selected country is kept in the selector even if the country-name search excludes it. Country-name searches now ignore surrounding whitespace.

### Showtimes

- A city-led editorial stage and the existing city chooser, followed by a compact planning sidebar and a source-program list.
- Existing shared location state/storage, explicit-only geolocation, seven-day selection, cinema/search filters, local-time formatting, source update time, partial-result warning, external search and ticket-source links are retained.
- Loading, unsupported city, source error/retry, empty date and empty filters remain distinct. No adjacent-city substitution or fabricated schedule is introduced.
- `groupCinemaShowings` groups by provider movie ID and cinema/address tuple. It sorts each venue's source records chronologically without mutating the response, and normalizes surrounding search whitespace. Provider movie IDs are **not** treated as local catalog IDs. Slot links still open the external source with `noopener noreferrer` and no referrer; no booking, playback or watched action is added.
- Date/location changes continue to cancel stale requests and isolate their snapshots by city/date/revision key. No provider API, location API, geocoding policy, schema or server-side business rule changes.

## Verification

- Unit coverage in `tests/cinema-journeys.test.ts`: grouping by provider ID, cinema/address separation, delimiter-safe keys, filters, stable chronological ordering, immutable snapshots and real atlas selection counts/co-productions/unknowns.
- `test:journeys:browser`: actual production app, a marker-guarded disposable local database, and intercepted deterministic schedule responses. Covers atlas auth gate, country deep links including unknowns, co-productions, personal/catalog/unseen/category filters, zoom/reset/keyboard navigation, pagination, quick-view state retention, city/date/cinema/search/local-time behavior, empty/unsupported/error/partial states, and five themes × eight widths × two routes.
- Browser tests do not request real GPS or book tickets. Schedule interception verifies presentation, not the live KudaGo service. Temporary users/movies/watches are cleaned up. Screenshots belong in `/tmp/mm-journeys-screenshots`, not Git.
- Existing location/showtime, geography/passport, route, shell and responsive suites provide regression checks. The new browser suite is registered in CI.

### Final local results

- **346/346 unit tests passed.** Final production build and TypeScript checks passed. ESLint: zero errors, two pre-existing image warnings in `share-modal.tsx` and `wrapped-share.tsx`.
- On the final production build, `test:journeys:browser`, `test:location:browser`, `test:passport:browser`, `test:browser` and `test:shell:browser` all passed. The new suite checks five themes × eight widths × two routes; the shell regression also checks fourteen widths/two themes.
- Additional fresh guest-page checks passed for the expanded empty-city chooser at 320/390 pixels in Russian and English, and for the guest atlas at 390 pixels in both languages. No automatic geolocation was requested.
- Reviewed desktop/mobile, dark/light introductions and map/program workspaces. Screenshots remain outside Git under `/tmp/mm-journeys-screenshots`.
- New tests wait for the authenticated lazy atlas to finish replacing its briefly retained offscreen guest subtree before counting cards. Unknown-country assertions include the suite's own unmapped fixtures without assuming that no other isolated fixture lacks country metadata.
- `git diff --check` passed. No production database, schema, provider configuration, hosting or deployment changes. Remote CI results are separate from these local checks.
