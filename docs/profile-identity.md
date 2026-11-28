# Profile identity studio

The existing **Киновизитка** and **Титулы** profile tabs now use a dedicated, scoped `profile-identity.css` workbench. No new routes, migrations, permissions, rewards, or publication actions are introduced.

## Titles

- Current server-selected title, automatic/manual/hidden explanation, available/total counter and the next unopened viewer rank.
- Always-visible collection, split into the existing viewer-path and special-merit categories. All / unlocked / still-ahead filters only filter presentation; they cannot grant ownership.
- Original descriptions, distinct-material progress, permanent-award state, actual equipped state, disabled locked choices and accessible progress bars.
- Automatic still selects the highest unlocked viewer rank, not a special title. Hiding the title does not erase ownership. The rules panel distinguishes profile titles from the achievement selected for the cinema card.
- Saving continues through the existing `titleEquip` action and server validation. A synchronous pending guard prevents duplicate submissions; failures remain visible and offer a retry of the requested choice. Success is shown only after the action resolves successfully; selection is never optimistically awarded by the client. An unconfirmed request does not claim that the server definitely rolled back.
- `src/lib/profile-identity.ts` derives filtered options, counts and the next unopened viewer title without mutating the collection or recalculating unlock conditions.

## Cinema card

- Larger profile entrance, canvas workbench with sticky desktop preview, explicit output dimensions, three mood swatches and two format choices. Mobile stacks the preview and controls in a scrollable dialog.
- Native modal dialog makes the background inert. Tab/Shift+Tab endpoints wrap locally; Escape, close, backdrop click and navigation dismiss the workbench. Focus returns to the launch control; CSS scroll locking follows the open dialog rather than imperative body overflow assignments.
- Existing Aurora / Premiere / Paper artwork and square 1080×1080 / story 1080×1920 PNGs remain unchanged. The same escaped, self-contained SVG drives preview and export. Async PNG results still match the current SVG identity and cancelled effects cannot overwrite a newer choice.
- Logo-load and PNG-generation errors offer an in-place retry. Downloads and file-sharing are unavailable until a matching PNG exists. Native file sharing still falls back to download when unsupported; Telegram and VK links share a profile URL and text, not an uploaded image. Clipboard failure leaves a selectable profile URL.
- Underlying aggregation is unchanged: watch sessions include repeats; distinct materials are separate; episodic time counts the full catalog duration; cast coverage is disclosed; alphabetical tie-breaks remain; the crown is an earned achievement with reliable community ownership statistics, not a manually equipped profile title.
- Public artwork contains username and cinema statistics, not email or messages. No generated images, browser downloads or screenshots are added to Git.

## Validation

- `tests/profile-identity.test.ts`: filtering/counts without mutation, permanent ownership, missing viewer ranks, completed progression and empty locked collection.
- `npm run test:identity:browser`: production UI and real API backed by a marker-guarded isolated local database. Covers filter counts, server rejection of a locked title, failed-save retry, persisted title/automatic/hidden choices, permanent ownership after removal of history, completed collection, actual PNG downloads in all six design/format combinations, logo and encoding retry, sharing/clipboard capability boundaries, native modal focus and scroll restoration, guest access and no watch/XP/popcorn mutations. Title layout is checked in five site themes at six viewport widths; card layout is checked in dark/light at the same six widths. Optional `IDENTITY_SCREENSHOTS=1` writes captures to `/tmp/mm-identity-screenshots`, outside Git.
- The browser suite runs sequentially in the existing isolated CI job.

## Results

- `npm test`: 357 passing tests.
- `npm run build` and `npm run typecheck`: passed against the isolated audit configuration.
- `npm run lint`: no errors; two pre-existing image warnings in `share-modal.tsx` and `wrapped-share.tsx`.
- `npm run test:identity:browser`: passed, including all six real PNG downloads, mocked native-share/clipboard capability boundaries, forward/reverse keyboard wrapping, closing and achievement-route exit.
- `npm run test:browser`: passed the existing 23-page navigation/control smoke suite without runtime/hydration errors or local HTTP 5xx.
- `npm run test:year:browser`: passed the existing yearbook/story/export regression suite.
- Dark/light desktop and mobile title/card captures reviewed; PNGs and screenshots remain outside Git.
- `git diff --check`: passed. No merge or deployment performed.
