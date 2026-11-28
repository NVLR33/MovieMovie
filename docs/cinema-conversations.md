# Conversations and two-view cinema comparison

Continuation of `community-cinema.md`: full messages, mini-chat and the taste-comparison page. This pass does not redesign collaborative collections, watch rooms or game mechanics.

## A conversation workspace

`cinema-chat.tsx` replaces the duplicated full-page/drawer thread renderers with one conversation pane. The full workspace has an editorial entry, a searchable inbox/eligible-friend rail and a focused thread canvas. Selecting a conversation reduces the editorial header. On mobile the contacts and active conversation are separate views; Back returns focus to contact search. The composer clears the site's mobile bottom navigation at the verified 390 × 800 viewport. Message history scrolls independently and new messages do not pull someone away from older history unless they were already near the end or explicitly sent a message.

Retained functions: existing conversations and latest snippets/dates, unread badges, friends without messages, profile entry, timestamps/read marks, film-only or text-and-film sending, catalog search/film picker, shared material cards and full material navigation. The picker also matches original titles. No fabricated online or typing indicators.

Drafts are in memory and keyed by recipient for the lifetime of the workspace. Switching contacts cannot put one recipient's text into another's input. A synchronous in-flight guard prevents repeated submits; successful sends clear only the exact draft submitted, preserving edits typed while the request was pending. Server/network errors preserve the draft and display a local error. Attachment sends use the same guard. Text matches the existing 2000-character server limit; Shift+Enter and IME composition do not accidentally submit.

`/chat?with=<id>` is a supported conversation entry. Expanding mini-chat opens the same recipient in the full workspace. Drafts are **not** written into URLs or browser storage and are not transferred across workspace unmount/expansion.

## Mini-chat accessibility

Mini-chat is now a named native modal dialog with an explicit Tab/Shift+Tab boundary, Escape/close, body-scroll cleanup and focus restoration to its connected trigger (or main content). Toolbar controls have accessible names. The same thread and composer implement error/retry, send guards and attachment behavior. A modal mini-chat intentionally makes the underlying page inert while open; this replaces the previous non-modal div.

## Two real viewpoints, not invented taste scores

`cinema-comparison.tsx` presents the two viewer identities beside a real common-rating story, then a searchable set of shared ratings. It retains both personal scores and makes each available material actionable through the existing quick-view flow; closing preview preserves comparison filters and focus.

`compareCinemaRatings` is pure and non-mutating. It intersects positive finite personal ratings, deduplicates movie IDs, and sorts largest absolute difference first with an ID tie-break. No public averages, unseen films or watches substitute for a missing personal rating. Missing catalog metadata has a readable title fallback and no unusable material-open action.

Rules are explicit on the page:

- **Главные споры:** difference greater than 1 point.
- **Единодушие:** both scores at least 8, difference at most 1. This deliberately makes the old high-rating rule symmetric instead of qualifying a lower rating on only the viewer's side.
- **Все общие:** every shared valid rating, not just five previews.

The spotlight is the greatest actual difference, with agreement-aware wording when all scores are close. No common ratings, no matches for a query, initial loading and failed-profile/retry states remain distinct. This composition does not create a new compatibility calculation or change public-profile API privacy.

## Transport and boundaries

The existing JSON resource hook keeps its first two tuple members unchanged and exposes a third loading/error status. URL-keyed data and aborted requests still prevent stale thread snapshots from replacing another recipient. Initial failures are no longer presented as an empty successful history. Transient failures retain the last successful snapshot. Chat widgets consume the shell's existing `moviemovie:live` event; they do not open additional EventSources, sockets or polling loops.

Existing friend-only server GET/POST authorization is unchanged. Guest chat/comparison routes remain gated and mount no private thread resource. Selecting an actual thread retains the existing server read-mark behavior. No migrations, dependencies, chat API changes, production DB changes or deployment.

## Verification

- `tests/cinema-comparison.test.ts`: common-only selection, positive/finite ratings, symmetry, exact agreement thresholds, gap/ID ordering, duplicate IDs and immutability.
- `test:conversations:browser`: marker-guarded disposable PostgreSQL + production app; real send/film share/unread marking, per-recipient drafts, duplicate guard/in-flight editing, initial-load retry and failed-send preservation, nonfriend rejection, comparison scopes/search/empty/retry/quick view, native mini-chat Tab/Escape/focus/expansion, mobile contact return and guest boundaries.
- Responsive matrix: five themes × eight widths × inbox/thread/comparison, plus eight mini-chat widths and a mobile composer/navigation boundary check. Screenshots remain outside Git: `/tmp/mm-conversations-screenshots`.
- Existing public-profile, community-cinema and responsive-UI regressions remain separate checks.

The preceding PR27 was merged by others. Its remote annotations still report `test:rankings:browser` failure (also observed on the preceding PR26). That is not fixed or declared green by this work; local results and future remote checks must be distinguished.

### Local validation result

- `npm test`: **315/315 pass**.
- `npm run build`, `npm run typecheck`: pass.
- `npm run lint`: 0 errors; two existing share-component image warnings.
- `test:conversations:browser`: pass on the final production build, including explicit dialog Tab containment/focus return, mobile composer clearance and full responsive matrix.
- Existing `test:profiles:browser`, `test:community-cinema:browser`, `test:ui`: pass. The static UI fixture also retains its single-SSE/coalesced-invalidation assertions with the updated resource hook.
- Dark/light desktop/mobile screenshot review completed; selected desktop conversation keeps its composer visible at 1440 × 1000.
- `git diff --check`: clean. This phase has not been pushed or deployed.
