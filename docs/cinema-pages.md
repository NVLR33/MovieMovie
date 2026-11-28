# Cinema spaces, next chapter: catalog and story pages

This pass continues the new homepage direction **inside two destinations**, not every feature page. Profile/library/community compositions are deliberately not represented as redesigned here. The shared navigation and quick view from the previous pass remain intact.

## Discovery workspace

The catalog is now a selection console beside a results canvas, rather than a stack of full-width filter strips:

- Editorial introduction and a contrasting rankings destination.
- Contextual **selection console**: query, moods, all precise filters, selected-filter chips and reset. This is not a restored permanent site-navigation sidebar. It becomes a compact stacked console at 900px and below.
- Genre rail and format controls belong to the results canvas; their contextual counts and all existing intersection rules are unchanged.
- A results deck groups the live count, visible sort selector, three persisted material views, a manual entry into the filtered selection and the actual grid.
- The manual entry cycles through exactly the currently filtered/sorted result array. It resets when options change, disables cycling for a single result, disappears for empty results and never substitutes unrelated recommendations. Poster preview is disabled here. Ordinary title activation uses quick view; modified-click/new-tab navigation remains native.
- A real focusable results anchor gives keyboard/mobile users a shortcut past the console. Existing quick-view behavior keeps local filters, the URL and feed position unchanged.

No catalog matching, sorting, collection semantics, permissions or API contracts were changed.

## Story file

The full movie page now separates its responsibilities:

1. A scenic opening with the shared poster, full adaptive title, original title, collapsible synopsis and compact expandable tags.
2. A distinct **personal action ticket** containing community rating/statistics, playback and its subordinate external link, explicit trailer, watched toggle, colored saved/favorite actions and sharing. The status reflects real collection state; a saved personal rating is displayed without inventing activity.
3. Chapter links to an editorial dossier, the viewer's verdict and related titles (when present). Native anchor navigation moves focus as well as scroll.
4. A responsive dossier/verdict bento instead of full-width strips. Discussion remains a full-width entry into the existing drawer, without an empty sidebar-height gap. Phone panels stack in reading order.

At smaller desktop/tablet widths the action ticket moves below the introduction. On phones, short titles share a row with the poster; titles over 75 characters get a full-width row to avoid a narrow, excessively tall text column. Existing mobile sticky rating/review/save actions remain. Seasons stay in a compact right-aligned button; playback does not track episodes. Rating colors, original logo, no poster zoom/gloss, detail editing permissions and real collection persistence remain unchanged.

The backdrop now uses the existing JSON-escaped CSS URL variable, not a separately single-quoted URL interpolation. Watch-state and text controls use theme-aware contrast, including light mode, while collection semantic colors remain independent. Reduced transparency and forced colors have explicit fallbacks.

## Implementation

- `src/components/catalog-screening.tsx`: manual filtered-selection entry.
- `src/components/cinema-pages.css`: scoped catalog/detail compositions, loaded after cinema-experience.css.
- `src/components/movie-go-app.tsx`: reorganized existing feature markup; existing state and handlers remain authoritative.
- `tests/integration/browser-cinema-pages.mjs`: new read-only production-browser fixtures; wired as `test:pages:browser` into isolated CI. Screenshots live outside Git under `/tmp/mm-pages-verified`.
- Existing catalog checks now verify that the manual entry always belongs to the actual filtered result set. Detail geometry checks now cover the bento/stacked layout and a real full-width empty verdict, rather than prescribing obsolete full-width strips or CSS grid implementation details.

## CI diagnosis

The previously merged workflow was red. Its remote log archive could not be downloaded in this network environment, so the exact remote failing assertion is not claimed as known. Replaying its sequence locally on a fresh marker-guarded isolated database passed HTTP routes, rolling trailer-schema compatibility, the 23-route browser smoke, suggestions, administration, auth and mobile, then reproduced a failure in `browser-ambient.mjs`.

That legacy scenario expected a catalog click to navigate immediately to a movie page; with quick view it instead matched multiple headings and failed before checking full-page atmosphere. The test now explicitly validates the quick-view step (background atmosphere remains unchanged), follows **Полная карточка**, then performs the original canvas/cache/color checks on the full page. Its obsolete exact text-color literal is replaced with an actual computed foreground/background contrast check of at least 7:1; measurement disables probe transitions to avoid sampling an interpolation. Orbit, collection-showcase and weekly-pulse navigation tests likewise explicitly continue from quick view before their full-page assertions. Coverage is preserved, not skipped. CI additionally emits a named-suite error annotation on failure, so a future failure can be identified without downloading a log artifact. A green remote CI run still requires publishing these changes.

No dependencies, database migrations/schema changes, production writes or deployment are part of this pass.

## Local verification for this pass

- Production build, typecheck and `git diff --check`: **PASS**.
- `npm test`: **298 passed**. ESLint: **0 errors**, the same two existing image warnings in share components.
- `test:pages:browser`: **PASS**, two compositions × five themes × eight widths (320–1920px), long-title adaptation, manual current-selection cycling, empty/reset, keyboard/anchor focus and quick-view scroll/route retention. Ambient is explicitly disabled in this matrix; actual extraction is tested separately.
- `test:catalog:browser`: **PASS**, original matching/counts/chips/sort/moods/formats/deep-link controls plus the new filtered-selection assertions.
- `test:detail:browser`: **PASS**, bento/phone geometry, long descriptions/titles/tags, playback/external-link ordering, colored persisted collections, admin editing entry, review drafts and seasons navigation.
- `test:experience:browser`: **PASS**, modal history, scroll/focus, guest auth, trailer, persisted saves/favorites and failed-action rollback.
- `test:ambient:browser`: **PASS**, actual canvas extraction/cache/stale-response cleanup, palette contrast, theme changes, reduced motion, Save-Data, CORS/canvas/storage failures and explicit full-page continuation.
- Regression suites **PASS**: HUD, passport, orbit, ranking library, collection showcase, weekly pulse, Frame matrix and actual-app responsive `test:ui`.

Validation used only local fixtures and the isolated disposable database. These are **local results**, not a claim that the already-completed remote GitHub run has become green. The continuation is published as a separate reviewable commit and pull request; merge and deployment are separate actions.
