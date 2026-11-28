# Cinema pet workspace

The private profile’s **Кинопитомец и попкорн** section now has one continuous workspace:

- A persistent home cinema with the pet, level progress, profile visibility, projector collection, and personalization.
- Five adjacent desks: care/missions, wallet, upgrades, wardrobe, and evolution/recent activity.
- A separate, explicit adoption screen. Opening the profile never adopts a pet.
- An expanded mobile layout: the home cinema precedes the desks, with wrapped cards and large care actions. Reduced-motion preferences stop the private pet’s idle animations.

The wallet keeps its savings goal, weekly/lifetime totals, weekly and lifetime reward claims, and private cursor-paginated history with filters/retry. Selecting a goal does not reserve funds or create a server mutation. Public pet cards retain their compact rendering and never receive wallet fields.

`cinema-pet-workspace.ts` contains display-only care availability and purchasable goals, derived from existing domain constants. No economy policy, schema, API, or server mutation implementation changed. Adoption rewards, prices, level gates, once-per-UTC-day care, fractional projector carry/24-hour cap, explicit bonus claims, expected-level upgrades, and transaction/idempotency enforcement remain server-owned. Existing abort, focus/midnight refresh, pending-request and stale-snapshot guards remain intact.

## Checks

- `npm test`: includes goal derivation and care-availability tests.
- `npm run test:wallet`: existing isolated PGlite API/economy/migration/security tests.
- `npm run test:pet:browser`: production app and a marker-guarded isolated local database. Covers load/operation/history failure recovery, adoption, care/level/funds gates, collection, purchases/free equipment, expected-level upgrades, goal purchase, cursor history/filtering, customization, public-card privacy, all five desks at eight widths in five themes, and no mutation/watch creation from browsing. Optional `PET_SCREENSHOTS=1` captures screenshots under `/tmp/mm-pet-screenshots`, outside Git. Captures are not required by CI: software-rendered Chromium can stall on repeated captures after viewport changes. The layout matrix still runs in full without them.
- The browser suite uses explicit test ledger funding rather than invented movie watches. It is registered in the existing sequential isolated CI browser job.

## Validation results

- `npm test`: 349 passing tests.
- `npm run build` and `npm run typecheck`: passed with the isolated database/session environment.
- `npm run lint`: no errors; two pre-existing image warnings in `share-modal.tsx` and `wrapped-share.tsx`.
- `npm run test:wallet`: passed, including wallet reconciliation, migration audit, security and concurrent claims.
- `npm run test:personal:browser`, `npm run test:community-cinema:browser`, and `npm run test:browser`: passed, including private/public profile regressions and navigation across 23 pages.
- The full pet browser scenario and 200-case layout matrix passed; dark/light mobile and desktop captures were also reviewed. Button-content geometry excludes the shared decorative shimmer pseudo-element, whose intentionally offscreen animation is not text clipping.

No database migrations, merge, or deployment were performed for this phase.
