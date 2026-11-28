# Together: public ballots and local cinema preparation

Continuation of `cinema-conversations.md`. This pass redesigns the signed-in **collaborative collections tab**, cinema lobby and local room. Curated studio/cast/genre collections remain available with their existing deep links and browsing behavior.

## Shared choice, one focused list

Collaborative collections now use an editorial introduction/creation panel and an index/detail workspace rather than a wall of repeated forms. The collection page's personal-tab heading is deliberately compact so it does not duplicate the new introduction.

- Search list titles, select a real list, inspect its films and add material by title or original title.
- Items are ordered by actual vote count, with stable item-ID ties. The spotlight labels the vote leader only when it has positive votes; otherwise it is explicitly the first story.
- Shared quick view retains the selected list and search. Existing curated collection controls remain unchanged.
- Create/add/vote use existing action APIs. Local errors preserve title/selection, with synchronous request guards and disabled controls during saving. Already-added materials stay out of the picker.
- A just-created list becomes the active workspace; duplicate titles resolve to the newest matching list ID.

**These lists are public to signed-in members**, not owner-only/private lists. No invitation/member-management feature exists in the backend and none is implied by the interface. Existing public participation rights are unchanged. Likewise votes are an incrementing counter, not unique people or a toggle; repeated votes and lack of undo are explicitly disclosed. No fake per-user voted state is introduced.

## Honest cinema lobby

The previous lobby promised synchronous viewing while the room itself was already local-only. The new composition states this limitation prominently and consistently.

The lobby separates material selection from the session plan. Search includes original titles; no film is selected implicitly. Film notifications to accepted friends require an actual selected material and use the existing server-authorized `share` action. They are labeled **film recommendations**, not room invitations: the notification points to the material, not a synchronized room. Failures have retryable visible feedback.

A generated code is a local reference identifier, not a server-created room or authorization secret. Creating a reference opens the selected material without writing watches or copying to the clipboard automatically.

## References without the movie-one fallback

`local-cinema-room.ts` parses route-compatible 4–64-character codes or same-origin room URLs/paths. External origins, credentials, arbitrary paths and malformed references are rejected. Valid explicit movie IDs survive a pasted link. A bare code may use the material the viewer explicitly selected in the lobby; without one, the room asks the viewer to choose a film.

The previous join action's `?movie=1` and room's first-catalog-item fallback are removed. A missing or removed referenced material has an explicit empty state, never an unrelated replacement.

## Local room, not simulated multiplayer

`cinema-room.tsx` provides a new player/control canvas with an adjacent personal notebook and a separate reference panel.

- No iframe exists until the viewer explicitly submits an allowed player URL.
- The unchanged `playerEmbedUrl` allowlist canonicalizes YouTube/RuTube/VK URLs; sandbox/referrer restrictions remain. Arbitrary pages never become iframe sources. Sources can now be replaced or removed without leaving the room.
- The external provider still controls video availability. A movie-card URL is not a playback entitlement or video source.
- The former local “room chat” is accurately labeled **notes in this tab**. Notes and reactions remain local and vanish on reload; another tab never sees them. A direct link leads to real friend chat.
- Reactions retain their effect, respect reduced motion, have accessible labels and clean up timers on unmount.
- A copied room reference includes only the code/material, not the video URL, notes or presence. Clipboard failure is reported, with a selectable reference for manual copying.

Guest gates remain. No room server, presence, shared timer, synchronization, WebSockets or new EventSource was added. No migrations, dependencies, API permission changes, production data changes or deployment.

## Validation

- `tests/local-cinema-room.test.ts`: code lengths/characters, same-origin links, movie-ID preservation, external/credential/path rejection and invalid/missing IDs without movie-one fallback.
- `test:together:browser`: marker-guarded disposable DB + production app. Real public list create/add/vote, retained failed drafts, selection/search/preview, selected-only friend notifications, safe room references, explicit allowlisted iframe start/replace/remove, local notes/reactions/reload/second-tab isolation, clipboard failure, missing material and guest boundaries. Five themes × eight widths × three pages; screenshots outside Git in `/tmp/mm-together-screenshots`.
- External iframe HTML is intercepted in browser tests. Passing tests verify source selection/UI/security, **not live provider playback**.
- Existing collection-showcase, playback, shell and static responsive-UI suites are separate regression checks.

The preceding PR28 was merged by others. Its remote annotation still reports the pre-existing `test:rankings:browser` failure observed on PR26/27. This phase does not claim to fix it or establish green remote CI.

### Local validation result

- `npm test`: **319/319 pass**.
- `npm run build`, `npm run typecheck`: pass.
- `npm run lint`: 0 errors; two existing share-component image warnings.
- `test:together:browser`: pass on the final production build (five palettes × eight widths × three pages, real isolated mutations and local-only boundaries).
- Existing `test:showcase:browser`, `test:playback:browser`, `test:shell:browser`, `test:ui`: pass.
- Dark/light desktop/mobile screenshot review completed; the fixed-dark player placeholder keeps readable accent text in light mode.
- `git diff --check`: clean. This phase has not been pushed or deployed.
