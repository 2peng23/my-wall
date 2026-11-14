# Modern wall redesign

Implemented and checked locally on November 15, 2026 (Asia/Manila), before source publication. Source repository: [2peng23/my-wall](https://github.com/2peng23/my-wall). No Vercel linking/deployment or hiring-form submission was performed.

## Delivered

- Joel Rioflorido's supplied portrait, copied unchanged, and his exact requested name.
- A warm neutral layout, ink-colored controls, locally hosted Manrope interface text and Instrument Serif profile typography.
- Removed the retro banner styling, promotional slogans, repetitive headings, decorative control icons, footer copy, and animated post backgrounds. The logo and favicon changes that appeared concurrently in the workspace were preserved.
- A 64 px desktop / 56 px phone header with no live indicator, reduced spacing, and one bordered panel around the composer and messages.
- Joel's job (Full Stack Developer) and location (Taguig City, Manila Philippines) beneath his name.
- A fixed-height page with scrolling limited to the messages region. The first read shows 20 messages; approaching the bottom loads another 20. A keyboard-accessible load button remains available. The centered Back to latest control appears after scrolling down and returns focus to the messages region. Incoming messages preserve the reading position. Delayed initial events are kept within the first 20-message window, and its pagination cursor follows the actual visible boundary so displaced entries remain available.
- A compact composer with optional name, an icon on Add photo, character counter, and Share. JPEG, PNG, WebP and GIF selections must pass size/MIME, signature and browser-decoding checks. SVG, disguised documents and damaged images are rejected. Shared photos are constrained to 200 × 128 px thumbnails with full-size links, leaving space for other messages.
- Drafts survive posting/upload failures. Older-page loading failures show a visible, retryable alert within the message scroller.
- Stable browser visitor UUIDs, anonymous labels such as `Visitor #A17C920B`, and optional names remembered in the browser. Clearing a name returns to the same anonymous label.

## Identity and database behavior

`mywall.visitor.v1` stores only the browser's random UUID and name preference. Same-origin reloads and tabs reuse that UUID and synchronize name changes; separate browser storage gets a different ID. There is no device fingerprinting or authentication claim. Site-data deletion/private browsing resets persistence, and blocked storage falls back to the current tab.

The third migration adds `visitor_id` and allows a nullable, validated `author_name`. New anonymous INSERTs require a UUID. Names are canonicalized and limited to 48 code points. Creation time remains database-owned; anonymous UPDATE/DELETE remain unavailable. Existing legacy messages and their names are preserved, with no invented attribution of old records to browser IDs.

## Verification

| Check                           | Result                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| Lint                            | Passed without warnings                                                              |
| TypeScript                      | Passed                                                                               |
| Unit/state tests                | 28 passed across 4 files                                                             |
| Real local database integration | 11 checks passed, including optional names, missing-ID rejection and name validation |
| Real local Storage integration  | 4 checks passed                                                                      |
| Chrome browser tests            | 15 passed                                                                            |
| Production build                | Passed                                                                               |

The final local production build was opened at 1440 × 900, 390 × 844 and 320 × 568. Existing messages and Joel's profile rendered correctly, the document stayed within the viewport, and photo thumbnails stayed within 200 × 128 px. The centered Back to latest button returned to the top, and clicking a thumbnail opened its full-size photo in another tab. No browser runtime errors occurred. This production pass did not create messages. The temporary production server on port 3001 was stopped; the review preview remains available on port 3000.

Browser tests cover anonymous posting, name-based posting, name clearing, reload persistence, two same-browser tabs, different browser contexts, name validation, live cross-context delivery, retry/deduplication, 20-message pagination, reading-position preservation, Back to latest and its focus behavior, failed-page recovery, keyboard use, all four supported photo formats, disguised/damaged-file rejection, and offline recovery. Test rows and successful test attachments are removed after each test.

Automated accessibility checks passed in populated phone and desktop views for the selected WCAG A/AA tags. Profile-label contrast was corrected after an initial finding in this compact revision. Layouts were checked at 320 × 568, 390 × 844, 600 × 800, 667 × 375, 768 × 700, 1024 × 640 and 1440 × 1000, with reduced motion and 200% scaling. Small-screen upload failure also leaves the message scroller usable. This is bounded Chrome automation and visual review, not comprehensive accessibility certification or physical-device/Safari testing.

A database integration run immediately after the migration missed a Realtime event; the isolated rerun passed all eleven checks, and the subsequent browser tests confirmed actual delivery between contexts. The final recorded results above refer to the passing runs.

## AestheticForge use

The art-direction brief compiled the actual product, requested portrait, reduced copy/icon scope, visitor workflow, and accessibility constraints. Its token compiler validated the warm-neutral palette, type pairing, spacing and restrained interaction timing. Direct file output was outside that tool's authorized root, so its validated output was applied through local source edits.

For this compact revision its viewport matrix reported no overflow, element overlaps, or small-target findings at 320, 390, 768, 1024 and 1440 px wide, each 844 px tall. These measurements cover the initial shell; populated message scrolling and control visibility were checked separately in Chrome. The form audit found the message, file and optional name controls labeled, with only the message required. Populated UI behavior and contrast were separately checked with Playwright/axe. Its direction review compiles supplied evidence; it is not an independent aesthetic score.

## Captures

- [Desktop](screenshots/compact-desktop.png)
- [Phone](screenshots/compact-mobile.png)

- [Small phone](screenshots/compact-small-phone.png)
- [Centered latest control](screenshots/compact-latest-control.png)

Existing local messages were retained. No fictional named audience activity was seeded for the redesign.
