# Catalog-backed home discovery tag

The home `cine-day-banner` no longer uses hard-coded weekday/holiday themes. Some old calendar branches had no filter at all; others used a text search for a genre absent from the catalog.

`catalogDayTags` now builds choices from actual comma-separated catalog genre tokens. It trims values, groups case-insensitively, counts each material only once per genre, and excludes the all-genres sentinel. `randomCatalogDay` selects uniformly among available tags; explicit rerolls exclude the current tag when another exists. Empty catalogs/no genre metadata produce no banner rather than an unopenable suggestion.

`/api/data.cineDay` is a populated random choice or null. Its existing label/filter/icon fields are retained for populated choices; href and count are added. The home component validates its selected tag against current films, so deleted tags are not retained on catalog refresh. An explicit client reroll remains selected across background refreshes while its tag exists.

The Open action is a real link to `/catalog?genre=…`, not broad free-text search. A local navigation from this banner clears an unfinished header search so it cannot accidentally narrow results to zero. Native modified-click/new-tab navigation remains supported. Long genre labels and both controls wrap on mobile; the existing banner composition is retained. No schema changes or external requests are introduced.

Validation: 253 unit tests, typecheck, lint (three existing image warnings), isolated production build; `test:cine-day:browser`, `test:catalog:browser`, `test:ui` pass. The new production-browser suite checks actual API tag counts, random rerolls, exact catalog transitions at four widths, stale-header-search isolation, URL-special tags, and single/no-tag edge cases. It is included in the existing isolated quality workflow.
