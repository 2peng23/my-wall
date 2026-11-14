# Architecture

My Wall has one public page. It uses Next.js for the page shell and image/font delivery, React for interaction, and Supabase for messages, Realtime and photo storage.

## Responsibilities

| Area                                  | Responsibility                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `src/app/page.tsx`                    | Server-rendered header, profile and page layout                              |
| `src/components/wall-app.tsx`         | Browser lifecycle, wall-store subscription and wiring the composer/feed      |
| `src/components/message-composer.tsx` | Message/name form, validation feedback and submission                        |
| `src/hooks/use-photo-attachment.ts`   | Photo selection, decoding, preview cleanup and upload reuse                  |
| `src/components/posts-feed.tsx`       | Scrolling, loading older messages and keeping the reading position           |
| `src/components/post-item.tsx`        | Presentation of one saved message and its photo                              |
| `src/lib/posts.ts`                    | Post contracts, validation, ordering, deduplication and submission matching  |
| `src/lib/wall-store.ts`               | Read/write state, pagination, reconnect reconciliation and safe retries      |
| `src/lib/posts-gateway.ts`            | Supabase query/subscription adapter implementing `PostsGateway`              |
| `src/lib/photos.ts`                   | Photo format/size/signature rules and Storage access                         |
| `src/lib/visitor-identity.ts`         | Browser identity/name preference and persistence                             |
| `supabase/migrations`                 | Authoritative constraints, permissions, bucket configuration and publication |

The store depends on the small `PostsGateway` contract rather than React or a specific database client. Unit tests substitute that boundary to exercise timing and failure cases. The Supabase adapter contains transport details; components receive state and actions. Form drafts, attachment selection and browser preferences have separate owners.

## Data and failures

Messages are ordered by database timestamp (including microseconds) and ID. Initial reads show 20 posts. Older-page reads use a stable cursor; newly received posts merge by ID. A wall that was initially empty establishes its cursor when messages become available, including after a disconnected interval.

Each pending submission retains its UUID across an uncertain response or an explicit retry. Recovery accepts only a record matching every submitted field. The gateway and store share that comparison. Stopping the store invalidates outstanding reads and writes, releases loading flags, and prevents a late response from changing a restarted session. It does not pretend a database write was canceled or discard its retry identity.

The attachment hook owns its object URLs and invalidates pending image work on replacement or unmount. A failed message save reuses the successful upload. Successful submission clears the draft/attachment; recoverable failures preserve them.

Database constraints and policies remain authoritative. Browser visitor IDs and display names are convenience labels, not authentication. Only public Supabase connection settings belong in the browser. Local integration helpers require the loopback backend and clean up only their own fixtures.

## Maintenance

- Keep static page content on the server; interactive state belongs to the wall and its form/hooks.
- Extend existing domain functions or the gateway for behavior changes before introducing another state library or abstraction.
- Add a migration for schema/policy changes; retain applied migrations.
- Keep the existing shadcn primitives and their required dependencies together. Their imports are used; they are not cleanup candidates.
- `npm run capture:demo` captures the existing wall without inserting sample messages.
- Store generated video deliverables in `MyWall Video/`. That folder is local and ignored by Git.

## Refactor verification

This audit preserves the interface, public data contract and database migrations. It adds regression coverage for pagination after an empty start and for save/lookup responses arriving after the store stops. Current results are recorded with the refactor commit; the production report describes the previously verified deployed commit separately.

Verified locally on November 15, 2026 (Asia/Manila):

| Check                      | Result                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| ESLint and TypeScript      | Passed                                                                                                      |
| Unit/state tests           | 32 passed across 4 files                                                                                    |
| Production build           | Passed                                                                                                      |
| Chrome browser tests       | 15 passed, including desktop/phone layouts, posting, photos, Realtime, pagination, retries and keyboard use |
| Local database integration | 11 checks passed                                                                                            |
| Local Storage integration  | 4 checks passed                                                                                             |
| Screenshot capture         | Passed; the set of saved message IDs stayed unchanged                                                       |

The cleanup removes obsolete planning/prompt artifacts, the original placeholder portrait, the unused logo concept, and superseded design captures/evidence. Current architecture, interface verification, production verification, database migrations and useful tests are retained. The refactor does not change production configuration or data.
