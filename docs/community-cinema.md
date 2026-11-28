# Community cinema: people, rankings and public diaries

Continuation of `personal-cinema.md`: this pass changes the friends directory, community leaderboard and public member profile. It does not redesign chat, compare-game mechanics or create a social activity feed.

## Compositions

- **People:** editorial introduction + a relationship-aware invitation panel; below, a searchable people directory with All / Friends / Incoming / Outgoing scopes and live counts. Cards separate identity from action controls. The invitation moves focus to the directory with the relevant scope selected.
- **Rankings:** a current-metric leader spotlight beside the editorial introduction; a separate workspace contains all six metrics, all seven top sizes, the real podium and full ranking. Signed-in viewers see their actual position within the top 100 (or a dash when absent). The ranking is not capped before sorting and uses the existing deterministic ID tie-break. Names and the spotlight lead to public profiles.
- **Public diary:** customized identity and relationship actions occupy the main stage; the real common-history/compatibility card is now alongside them. Zero shared films is represented as zero, not replaced by a recommendation. A self/guest introduction replaces private viewer-to-member comparison data. Below, progression, pet, detailed statistics, genres, personal ratings, categories and recent history remain intact in a new bento. All five cover skins, uploaded cover, effects, titles, avatar/frame and roles remain feature-owned.

The same small navigation connects people, rankings and existing conversations. Scoped CSS imports last, and the static actual-app responsive fixture includes it too. Existing semantic colors, reduced-motion behavior, native keyboard controls and focus styles remain in effect. Ranked rows no longer slide in from outside their container; hover does not move podium cards.

## Real interaction, unchanged authority

`community-directory.ts` is a pure selection helper: it removes the viewer, deduplicates IDs, trims/case-folds search, intersects scopes and only considers relationships between the actual viewer and peer. A third-party friendship can never grant viewer controls.

Sending/accepting requests uses existing action APIs and refresh behavior. Incoming cards expose Accept, outgoing cards show sent state without another Add action, and accepted cards expose Chat. Every directory card now offers the public profile; the profile API still decides what is public. A failed action retains the original relationship and exposes a retryable local error; request controls disable while saving. No auto-acceptance, new moderation permissions, direct SQL from the UI or fabricated online indicators.

Existing profile failure/retry, relationship refresh, chat and comparison actions are retained. Guest friends routes remain gated; the leaderboard and public member profiles remain public. Browsing records no watches/rewards. No changes to schema, production DB, storage, auth, economy, chat transport or deployment.

## Validation

- `tests/community-directory.test.ts`: viewer exclusion, ID deduplication, direction-sensitive scopes, unrelated-pair isolation, search intersections and immutability.
- `test:community-cinema:browser`: actual production app against a marker-guarded disposable local PostgreSQL database. Creates only its own short-lived users, relationship and movie fixtures and cleans them up. Real send/accept, failed-action retry, search/reset/scopes, chat/profile/comparison navigation, six ranking metrics, seven limits, empty snapshots, guest boundaries, no automatic watches. Geometry matrix: five themes × eight widths × three routes. Screenshots outside Git: `/tmp/mm-community-cinema-screenshots`.
- Existing regression suites remain separate: public profiles (including five cover skins, long identities, full-history common count and retry), ranking library, homepage community, shared responsive UI.

The preceding PR26 has been merged by others. A GitHub annotation reports `test:rankings:browser` failing there; its detailed log could not be retrieved in this environment. The same suite passes locally with the community changes. This is not proof that remote CI is green; a new remote run is still required after publication.

### Local result

- `npm test`: **310/310 pass**.
- `npm run build`, `npm run typecheck`: pass.
- `npm run lint`: 0 errors, the same two existing share-component image warnings.
- `test:community-cinema:browser`: pass after final layout/contrast adjustments; five palettes × eight widths × three routes, real relationship mutations and guest gates.
- `test:profiles:browser`, `test:rankings:browser`, `test:community:browser`, `test:ui`: pass.
- Visual review: dark/light desktop and mobile screenshots. Podium metric text uses the theme accent instead of low-contrast gold; gold remains decorative on trophies/frames.
- `git diff --check`: clean. Nothing from this pass has been committed, pushed or deployed.
