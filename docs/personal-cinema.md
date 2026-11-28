# Personal cinema: diary and owned shelves

This continuation changes the **signed-in profile, Watch later and Favorites** compositions. It does not claim a new community/public-profile layout. The catalog/story-page pass is documented in `cinema-pages.md`.

## Identity-led diary

The profile now begins with an asymmetric identity/saved-story stage. The original profile cover skins, uploaded header, avatar/frame, name effects, display title, profile text and editing actions remain feature-owned. The avatar uploader is now a named native button instead of a click-only div.

A compact **Saved by you** panel offers a manual entry into real saved films, with explicit quick view and an empty invitation to the catalog. This is not playback continuation or a personalized recommendation engine. It does not infer unfinished viewing or mark anything watched.

Shared shelf navigation connects the diary, Watch later and Favorites with real collection counts. Profile subspaces (diary, pet/popcorn, cinema card, titles) remain intact. Native chapter links move focus to the passport, progression and diary entries. The passport panels and diary tiles use a new asymmetric composition; history gets a full-width canvas, while detailed statistics, categories, achievements and friends remain available.

Existing saved tile order, visibility toggles and profile decoration editing are retained. **No new homepage/dashboard customization system** is introduced. Progression, XP, achievements, pet economy, UTC passport calculations and memory-orbit rules are unchanged.

## Interactive owned shelves

Both shelves use one composition and one pure selection predicate:

- Editorial introduction with collection size, unwatched count and count without a personal rating.
- Manual spotlight drawn only from the **current owned, filtered selection**. Changing options resets its cursor; a single item disables cycling. Filtered-empty and truly empty collections have distinct messages; neither inserts unrelated films.
- Live title/original-title/genre search; exact material format; watched/unwatched; rated/unrated by the current user; catalog order, own rating, community rating, release year and alphabetical sorting.
- Visible count/reset and the existing globally persisted cards/compact/list controls. Original collection order is explicitly called catalog order, not invented save chronology (bookmark timestamps are not available in this UI data).
- Existing shared posters, colored wishlist/favorite actions, semantic ratings and quick view. Filters and layout remain mounted while previewing. When removing the movie also removes the original trigger, quick-view close focuses `main-content` without jumping the viewport instead of leaving focus stranded.
- Guest routes keep the existing authentication gates and never render another user's personal workspace.

Selection is pure, non-mutating and deduplicates ownership by movie ID. Rating-state and own-rating sort use the signed-in user's ratings, not the public average. All filters intersect; anime formats remain distinct. No ownership data, storage schema or action APIs were added. English labels are provided for the new library controls; existing profile feature translations remain as before.

## Files and verification

- `src/components/personal-cinema.tsx`: shared shelf navigation, manual saved-story entry, owned-library workspace.
- `src/components/personal-cinema.css`: scoped responsive compositions, preserving feature colors and cover customization.
- `src/lib/personal-library.ts`: pure filtering/sorting helper.
- `tests/personal-library.test.ts`: source-only selection, intersections, personal/public rating distinction, deterministic order and non-mutation checks.
- `tests/integration/browser-personal-cinema.mjs`: marker-guarded isolated production-browser verification; wired into CI as `test:personal:browser`. Real own/peer collection fixtures, mutations/rollback, profile text persistence, guest/empty states, focus and five themes × eight widths × three pages. Screenshots live outside Git in `/tmp/mm-personal-screenshots`.

The public-profile regression's old 1480px canvas expectation is updated to the already-shipped 1720px cinema shell. The old assertion no longer described the current app; the overflow, content bounds, all cover skins, actions and privacy checks remain in the suite. GitHub's latest PR25 annotations identify this suite as failing; the new changes still require a fresh remote run after publication.

All DB-backed validation uses the disposable marker-guarded local database. No new dependencies, migrations, production database writes or deployment.

### Local validation result

- `npm test`: **305/305 pass**.
- `npm run typecheck`, `npm run build`: pass.
- `npm run lint`: no errors; two pre-existing `no-img-element` warnings in share components.
- Production browser suites: **personal, profiles, HUD, passport, orbit, cinema experience** all pass. Shared `test:ui` also passes.
- Personal matrix: five themes × eight widths × three routes, plus five owned cover skins, actual empty shelves and English controls. Public profiles also retain their eleven-width/two-theme checks.
- `git diff --check`: clean. These are local results, not a claim of new green GitHub checks or deployment.

The public-profile fixture now uses a unique long username per run, including its friends-page lookup, so repeated isolated runs cannot collide with leftover audit users.
