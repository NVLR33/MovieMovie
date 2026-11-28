# My cinema year

`/wrapped` now opens a yearbook overview inside the regular site shell instead of immediately taking over the screen. The existing authenticated gate remains in place.

## Experience

- A UTC-year picker, premiere panel, actual watched-material covers and a private summary of watches, unique materials, catalog-duration hours and current ratings.
- Nine chapter entry points matching the existing immersive story order. Opening a chapter starts there; the overview and story year selectors stay in sync.
- Explicit story launch and explicit export. Nothing auto-advances or publishes, and browsing does not add watches, XP or popcorn.
- Empty years offer a different year or the catalog, not fabricated statistics. Load failures offer a retry. Aborted previous-year requests cannot overwrite a newer selection.
- A named desktop chapter rail, accessible progress buttons, keyboard navigation and horizontal-only swipe navigation outside form controls.
- Story and export use native modal dialogs with inert backgrounds, Tab wrapping, topmost Escape handling and focus restoration. If changing year replaces the launch card, focus returns to the overview heading. Scroll locking follows open dialogs in CSS rather than order-dependent nested effect cleanup.

## Data and exports

The authenticated `/api/wrapped` endpoint, database schema, aggregation and reward rules are unchanged. The picker exposes its existing accepted range, 2000 through the current UTC year. Watches use the endpoint’s UTC date boundaries; repeats count as watches, distinct material IDs count separately, and episodic duration uses the catalog’s episode count. The overview explicitly explains that ratings are **current ratings on materials watched in the selected year**, not ratings filtered by the date they were assigned.

The existing five canvas card designs and three PNG sizes are retained: story 1080×1920, post 1080×1350 and square 1080×1080. The chapter shortcut now actually selects the corresponding card (time, genre, movie, achievements or summary). Controls follow the site theme while exported canvas artwork keeps its existing design. PNG-generation failures can be retried, and the existing native-share fallback and object-URL cleanup remain intact.

## Validation

- `tests/cinema-year.test.ts`: chapter ordering, API-aligned year range, bounded chapter entry and initial export-card mapping.
- `npm run test:year:browser`: marker-guarded isolated local database and real production app/API. Covers own-user UTC data, repeats, episodic duration, current ratings, year switching, no-data years, delayed responses, load/story retry, all nine chapters at five widths, keyboard/select behavior, nested focus/Escape, year synchronization, actual downloaded PNG signatures and dimensions for all three formats, all five card previews, export retry, route exit, guest access and no watch/XP/wallet mutations. The overview is checked in five themes at eight widths. Optional `YEAR_SCREENSHOTS=1` writes captures outside Git under `/tmp/mm-year-screenshots`.
- Registered in the existing sequential isolated CI browser job.

## Results

- `npm test`: 353 passing tests.
- `npm run build` and `npm run typecheck`: passed with isolated database/session configuration.
- `npm run lint`: no errors; the two existing image warnings remain in `share-modal.tsx` and `wrapped-share.tsx`.
- `npm run test:year:browser`: passed the complete real API/UI and export scenario, including swipe/cancellation/control guards, retry after PNG-generation failure, export frame/dialog bounds at five widths, light-theme action text and final actions scrolling clear of the fixed navigation.
- `npm run test:browser`: passed navigation across 23 pages without runtime/hydration errors or local HTTP 5xx.
- `npm run test:shell:browser`: passed the shared shell, focus/navigation and restricted-storage checks across 14 widths and two themes.
- Dark/light desktop overview and desktop-story/mobile-overview/final/export captures were visually reviewed; test screenshots and downloads remain outside Git.
- `git diff --check`: passed.

No migration, merge or deployment is part of this phase.
