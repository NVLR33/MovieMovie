# Four-mode cinema roulette

## Behavior

All existing roulette entry points now open a mode chooser rather than immediately starting a draw. The old inline roulette state/timers/markup and unused scoped CSS are replaced by `cinema-roulette.tsx`, `cinema-roulette.css` and pure eligibility/selection helpers in `roulette.ts`. Other page structures remain unchanged.

- **Surprise:** all currently loaded catalog titles, subject to explicit filters; violet orbital/star scene.
- **Unwatched:** signed-in user's actual watch markers exclude watched titles; emerald radar/grid scene.
- **Watchlist:** current user's actual bookmarks only; amber perforated-ticket/filmstrip scene.
- **One evening:** only Фильм/Мультфильм/Аниме-фильм with finite positive runtime within 90/120/150/180 minutes (default 120); indigo moon/night auditorium scene. Unknown runtimes and serial categories never silently enter the pool.

Personal modes show an authentication explanation for guests, not a substituted general catalog. Mode choices, format/genre/minimum-rating filters and runtime changes immediately affect the pool count. Genre matching uses exact comma-separated tokens; unrated titles do not meet a positive rating minimum. Empty pools explain how to relax the choice; no filter is silently ignored.

The draw is uniform over eligible candidates not already drawn in the current recent history. Once exhausted, a new choice avoids the immediately previous result when alternatives exist. Histories are bounded by pool size, stored only in memory per mode for the open dialog, and reset on close. A one-title pool remains usable. The winner is fixed before animation and inserted at the center slot; no external API, autoplay video, audio or currency mechanics are used.

The result includes poster fallback, score tone, format/year/runtime, real mode context, an Open action and real optimistic Watch later addition. Saved materials cannot be accidentally toggled out by this button. The shared action layer handles authentication/persistence and rollback; failed saves can be retried.

## Lifecycle and accessibility

Native modal dialog in a body portal; named dialog, explicit close, Escape/backdrop close, visible focus styles, cycling Tab focus, scroll lock/restoration and trigger focus restoration. Closing is allowed during the draw. The reel is decorative/aria-hidden; an aria-live status announces progress/counts and completion focuses the result title.

Three-second CSS motion centers through responsive CSS slot dimensions, not a guessed viewport width. Skip immediately reveals the same winner. Reduced-motion users get an immediate result; changing the preference during animation completes it. Animation end and a bounded fallback timer complete draws; timers/listeners are removed on unmount. Mode/filter/eligible-catalog/auth changes invalidate the stage and cancel stale draws. Styling is component-scoped with two-column mode cards on mobile and four columns on desktop.

## Daily tag screenshot / release state

The user's screenshot contains the old hard-coded copy «Кино на каждый день / Подборка на каждый день в кинотеатре». That string/template is absent from the current source. The catalog-backed fix is in prior local commit `c19661d`; that turn explicitly did not push or deploy it. This implementation does not deploy either. A stale or still-unpublished build should not be diagnosed as a newly reproduced filtering failure.

Current `CineDayBanner` renders a real genre, exact catalog link, count and optional reroll; it also marks `data-cine-day-version="catalog-v2"` for checking which UI is actually served. Copy explicitly labels it a catalog tag. The production browser suite rechecked visible links and nonempty exact-genre transitions.

## Validation

258 unit tests pass, including mode eligibility, runtime bounds, exact filtering/unrated handling, histories and reel/winner identity. Typecheck, lint and isolated production build pass; lint has the same three existing image warnings.

`npm run test:roulette:browser` uses marker-guarded disposable database fixtures and a production server. It checks personal exclusions/bookmarks, no repeats across the initial full pool, actual save persistence, empty and guest states, all four distinct scenes in light/dark at 320/390/768/1440, centered winners, reduced motion, natural animation completion, skip, resize, keyboard focus, Escape and close during motion. Included in the existing isolated quality workflow. Daily tag, mobile, material design and general responsive UI browser suites also pass after the change.

No schema migration, production database access, deployment, push or new commit is performed as part of this task.
