# Cinema spaces: moviemovie experience redesign

## Direction

The second pass changes composition and navigation, not just surface styling. A full-width cinematic spotlight is the homepage focal point; an asymmetric launchpad and interactive mood console support it. The permanent sidebar is no longer mounted. The original PNG logo and lowercase moviemovie name are unchanged.

The site is organized into three spaces: **Открывать / Моё кино / Вместе** (Discover / My cinema / Together). A floating glass header carries the spaces, an always-available search field, settings, notifications and account controls. Secondary links change with the space; the all-sections native dialog retains all destinations, authentication requirements and permission-gated administration. Mobile retains its existing bottom navigation and More dialog, with a compact logo/menu/search header. City selection stays above the header; showtimes remains a separate destination.

The default graphite/mint visual foundation and light, pink, purple and yellow themes share the same layout. Glass is restricted to navigation and atmospheric overlays; reduced transparency, unsupported backdrop filtering, reduced motion and forced colors have fallbacks. Locally bundled Golos remains the heading/card face, including body-mounted dialogs. Existing material rating colors/halos, wishlist/favorite colors, uniform posters, compact/list views and no-zoom/no-cursor-gloss behavior remain feature-owned.

## Homepage

- Up to four real catalog titles, featured first, appear in a manually controlled spotlight. Arrows and poster choices change the focal story; nothing auto-advances. Long titles/descriptions clamp without changing their accessible text. Its main action opens quick view; roulette is a separate explicit action.
- The launchpad combines an editorial greeting, catalog/library entry, compact world-map and community destinations. Signed-in users see their real saved titles (up to three) and collection activity; guests receive a useful discovery invitation. No customization/dashboard builder or invented recommendations.
- The mood console is integrated into a contrasting two-part editorial section. Existing home rankings, weekly pulse, studios, actors, genres, daily tag and other modules remain below the new opening composition.
- Empty catalogs retain useful discovery/navigation states.

`EveningDiscovery` remains a deterministic catalog browser, not an AI recommender. Four moods reuse `matchesCatalogMood`; explicit editorial labels take precedence over the existing genre fallback. Results sort by rating, vote count and ID without mutating the catalog. Counts, cycling and catalog continuation use the same rule. Empty pools never substitute unrelated films. Reset/pressed states/keyboard activation/live results remain accessible. `/catalog?mood=...` is a real link; movie activation now uses quick view, with native modified-click behavior preserved. Mood browsing does not write watches, ratings, XP or account state.

## Movie quick view

Ordinary browsing clicks on known `/movie/:positive-PG-integer` links open a native modal above the current feed. Other destinations and direct movie URLs keep normal routing. A full movie page remains available inside the dialog, including native new-tab behavior.

- Same-URL history entries hold a private preview marker plus background coordinates; browser Back closes, Forward reopens. Scroll restoration is applied after native/Next history restoration. Filters remain in the original URL; the feed stays mounted.
- Full-page continuation replaces the temporary preview entry so Back returns to the feed rather than an extra preview. Reload discards an orphan preview marker and loads the actual background URL.
- Native inertness is supplemented by keyboard wrapping. Escape/backdrop/close return focus to the original control and release the document scroll lock.
- Trailer players mount only after an explicit action. Inline playback avoids conflicting nested modal locks; the first Escape closes the player, the next closes quick view.
- Save/favorite use existing authenticated optimistic actions, ownership rules and real persistence, with pending buttons and recoverable failure feedback. Guest actions open authentication. Nothing auto-marks a film watched or submits a rating.

Files: `cinema-navigation.tsx`, `cinema-home-stage.tsx`, `movie-quick-view.tsx`, `cinema-experience.css`, `src/lib/cinema-spaces.ts`, `src/lib/dialog-focus.ts`; integration in `movie-go-app.tsx`. `cinema-experience.css` loads after `visual-system.css`. Legacy sidebar exports/styles remain for compatibility but AppSidebar is not rendered.

## Verification for this second pass

- `npm test`: **298 passed**, including new destination classification and strict preview-link parsing tests.
- Production build, typecheck and `git diff --check`: **PASS**.
- ESLint: **0 errors**, two pre-existing image warnings in share components.
- `test:experience:browser`: **PASS**. Real local production app and guarded isolated DB: route/filter/scroll/focus retention, Back/Forward/reload/full-page navigation, explicit trailer, guest auth, persisted bookmark/favorite actions, failed-action rollback and no automatic watches; 11 widths × dark/light; manual spotlight and real signed-in saved shelf.
- Replaced the obsolete sidebar suite: `test:shell:browser` **PASS**. All destinations/guest gating, active space/section, modal focus wrapping/Escape/restore, search shortcut, footer, roulette, 14 widths × dark/light, blocked storage and ignored retired sidebar preference.
- `test:frame:browser` **PASS**. Mood counts/cycling/empty states/keyboard/real navigation; five themes × six home widths; ten routes × two themes × two widths; typography, reduced motion, forced colors and no action writes. Read-only API fixtures intercept both `/api/data` and `/api/pulse` to avoid live refresh replacing controlled data.
- Regression **PASS**: mobile, branding, material detail, account, settings, catalog, card design, community, plus `test:ui` actual-app responsive fixtures. Branding now scrolls lazy footer artwork into view before decoding; account hydration checks attachment rather than requiring the intentionally compact header username to be visible.
- New experience suite is wired into the existing isolated CI workflow. Browser screenshots remain outside Git, under `/tmp/mm-experience-screenshots`, `/tmp/mm-experience-shell`, `/tmp/mm-frame-screenshots` and existing suite folders. They use test catalog artwork, not production editorial imagery.

All DB-backed validation used the marker-guarded disposable local PostgreSQL database. No new dependencies, schema changes, migrations, production database writes or deployment. Publication is through a separate reviewable commit and pull request; merging and deployment are separate actions.
