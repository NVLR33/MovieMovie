# Sidebar, header and site footer

## Scope

Visual and navigation improvements to the existing application shell. Original supplied `moviemovie` artwork, page structure, settings/account/notification dialogs, city selector, contextual movie toolbar and mobile bottom navigation remain in place. No schema, dependencies, production configuration or new destinations.

- Sidebar: grouped navigation, clearer active state (`aria-current`), watchlist/favorite/chat counts (visual cap `99+`, full number in title), cinema/showtimes shortcut, existing role/auth restrictions and existing cinema roulette. A room URL highlights the watch-room section.
- Sidebar layout: expanded, collapsed and automatic. Automatic uses the compact rail at desktop widths up to 1050px. The desktop rail is hidden at 760px and below, where established mobile navigation takes over. Scrollable links remain separate from the fixed layout controls.
- Layout choice is browser-local, not an account setting: `mg_sidebar_layout_v1`. Unknown values fall back to automatic. Storage events synchronize tabs; blocked storage keeps the selection in memory for the current visit and displays an explanation. It is intentionally not part of the site appearance reset.
- Header: refined search/action styling, a shortcut to the **existing** roulette, bounded long account names and icon-only compact actions. Search still has its visible entry, Ctrl/Cmd+K and normal submit/results. On 761–900px screens with an explicitly expanded sidebar, search and actions use separate rows rather than squeezing the input. City selection remains above the header.
- Footer: original brand artwork, two groups of real local links, current copyright year and keyboard-accessible back-to-top with content focus restoration; reduced motion respected. Actual anchors preserve modified-click/new-tab behavior. No placeholder privacy/about/contact pages.
- Keyboard: skip-to-content link, visible focus indicators, accessible names for the compact rail and explicit expanded/auto states.

## Files

- `src/components/shell-navigation.tsx`: shell components and synchronized browser preference hook.
- `src/lib/navigation-preference.ts`: pure preference normalization and compact-state resolution.
- `src/components/shell-navigation.css`: shell styles, loaded after feature styles in root layout.
- `src/components/movie-go-app.tsx`: integration with existing navigation, collections, auth, permissions and live connection status.

## Verification

`npm run test:shell:browser` runs read-only against a **local production build**. Public data is used for the guest flow; signed-in counts/long-name checks use intercepted `/api/data` fixtures, not database writes. It covers remembered collapse/reload, explicit/auto responsive modes, cross-tab updates, storage denial, keyboard skip/search, guest gating, showtimes active state, footer links/back-to-top, roulette, 11 widths × two themes and signed-in narrow/expanded layouts. Browser screenshots are stored outside Git in `/tmp/mm-shell-screenshots` by default.

Other regression suites: `test:account:browser`, `test:settings:browser`, `test:mobile:browser`, `test:brand:browser`, and `test:ui`. The shell suite is included in the existing isolated CI workflow. Unit normalization/breakpoint checks are in `tests/navigation-preference.test.ts`.

### Local results

- `npm test`: **292 passed**, no failures.
- `npm run typecheck`, `npm run build`, `git diff --check`: **PASS**.
- `npm run lint`: **0 errors**, two pre-existing `<img>` warnings in `share-modal.tsx` and `wrapped-share.tsx`.
- Final production build: `test:shell:browser`, `test:account:browser`, `test:settings:browser`, `test:mobile:browser`, `test:brand:browser`: **PASS**, run sequentially against the isolated local database.
- `test:ui` with shell CSS included in the actual-app fixture: **PASS**, eight widths from 320 to 1920px.

No production database, migrations, deployment, commit or push was performed for this change.
