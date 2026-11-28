# Games, trophy cabinet and challenge calendar

## Scope

- `/games`: editorial warm-up plus a searchable 16-mode library. Filters group recognition, detail and comparison games. A native modal dialog keeps the training above the current page, supports Escape, focus containment/restoration and scroll locking. Every playable practice contains five four-choice questions. Guests can play; authenticated players can store practice scores and retry a failed save.
- `/achievements`: collection overview, a closest-next-threshold spotlight, category/search/state filters and four-tier disclosures. Card actions no longer nest inside an interactive card. Existing ownership rarity, Bronze/Silver/Gold/Platinum thresholds, archaeology/series catalog destinations, hidden trophies and per-user/device trophy reveal persistence remain intact. Hidden trophies are shown separately and only when already unlocked; filters apply to regular achievements.
- `/challenges`: current-month spotlight, earned/completed summaries, all twelve selectable months and completion filters. Monthly cards use server progress, completion, rewards and community ownership. The catalog shortcut now applies both genre and category when both are required, matching the existing server AND condition (the old hint incorrectly said OR).
- Shared feature navigation links the three existing routes. No new personalization, widgets or dashboard builder.

## Practice integrity

`src/lib/cinema-practice.ts` owns the existing sixteen mode definitions and the client-side question generator. It requires at least four distinct catalog titles. Questions without enough meaningful metadata/options are skipped; an unavailable mode presents an explicit message rather than starting a broken game. With fewer than five valid questions, the five-question training may repeat questions; the lobby discloses that limitation.

Each question has exactly four distinct options with the designated answer included. Chronology chooses three strictly later alternatives, rating comparison requires actual rating counts and strictly lower alternatives, and connections uses exact comma-separated genre tokens rather than substring matches. Genre distractors exclude the source film's secondary genres. Letter/anagram distractors exclude matching clues; empty metadata does not become a made-up director, country or original title.

This remains **practice**, not a verified competitive quiz. Answers and scores are calculated in the browser and can be manipulated. The existing `/api/action` game branch is unchanged: it validates the known mode and an integer score from 0 to 5 and stores a practice-history row only. It does **not** award XP from client assertions. UI submission guards prevent ordinary repeated clicks; retry is not a new server-side idempotency guarantee after an ambiguous network failure.

No changes to achievement definitions, unlock/reward conditions, challenge evaluation, pet/economy, schema/migrations, production data, hosting or deployment.

## Checks

- `npm test`: includes deterministic question invariants across all sixteen modes and twenty seeds per mode, insufficient/duplicate catalogs, missing metadata, strict chronology/ratings, exact genre matching, original progression thresholds, filters and combined catalog links.
- `npm run test:play:browser`: runs the actual production app against a marker-guarded disposable Unix-socket database. Its temporary films, ratings, full twelve-month calendar, users and progress are cleaned up. It verifies guest play/auth gates/shortage messaging; all sixteen five-round/four-option games; real score writes and unchanged XP; save-failure retry; achievement search/state/tier disclosures/reveal persistence/catalog; real challenge award idempotency via the existing watch action; twelve month controls and completion filters. Five themes × eight widths × three pages are checked for horizontal clipping. Screenshots go to `/tmp/mm-play-screenshots`, not Git.
- Legacy route smoke adds two temporary source films only for its final game, keeping earlier catalog/map assumptions unchanged, then removes them. New play tests and the legacy profile suite wait for the existing settled HUD/session signal rather than racing SSR content against the first data refresh.
- CI includes the new browser suite. Remote CI is not inferred from local results.

### Local validation results

- **341/341 unit tests passed.**
- Final production build and TypeScript checks passed. ESLint: zero errors, two pre-existing image warnings in `share-modal.tsx` and `wrapped-share.tsx`.
- New `test:play:browser` passed on the final production build, including 16 modes × 5 rounds × 4 choices, real practice-history writes/no XP, actual challenge completion/reward idempotency, and 5 themes × 8 widths × 3 routes.
- Regression suites `test:browser`, `test:ui`, `test:shell:browser`, `test:together:browser`, and `test:profiles:browser` passed. The profile suite includes all twelve months at eleven widths/two themes and manual transient-error recovery. These regressions ran before the final semantics-preserving story-pool optimization and sticky-header scroll-spacing adjustments; the new play suite was rerun after those changes.
- Reviewed desktop/mobile, dark/light, workspace and practice-dialog screenshots. Additional fresh-page mobile checks confirmed the full game labels render correctly after a resize-heavy headless screenshot run produced a transient compositor artifact.
- `git diff --check` passed. Validation used the isolated local database only; no production deployment or schema changes.
