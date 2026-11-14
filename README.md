# My Wall

A personal public wall for **Joel Rioflorido**, built with Next.js 16.4.6, React 19.3.1, TypeScript, Tailwind CSS 4, React shadcn/ui, and Supabase. The modern layout uses Joel's supplied portrait, Manrope interface text, and Instrument Serif for the profile name. Visitors can share a short message and an optional photo without an account, using a persistent visitor label or an optional name. The newest messages appear first, arrive live in other browsers, and remain after a refresh.

**Repository: [2peng23/my-wall](https://github.com/2peng23/my-wall), branch `main`. The application is configured for local development; it has not been deployed to Vercel.** Supabase runs as this project's own Docker stack; it is a real Postgres / Data API / Realtime / Storage integration, not a browser-storage simulation.

## Run locally

Use Node.js 24 LTS (see `.nvmrc`), npm, Docker Desktop, and Google Chrome for browser tests.

```sh
nvm install
nvm use
npm ci
npm run setup:local
npm run dev
```

Start Docker before running setup. The initial Supabase start downloads its container images and can take a few minutes. The setup script starts the minimal required services, applies pending migrations to the local project, and creates `.env.local` with only browser-safe connection settings. It preserves an existing environment file and never copies the database's private keys into the app.

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

The local Supabase project ID is `mywall`, API port is `54321`, and Postgres port is `54322`. Setup uses a dedicated `mywall-local` Docker network. The app preview binds to `127.0.0.1`; Supabase's Docker port publishing follows the installed CLI's behavior. The stack does not modify other Docker projects.

```sh
npm run db:status    # Safe status summary, no credentials
npm run db:migrate   # Apply pending migrations to the local project
npm run db:stop      # Stop this project's Supabase services
```

`npm run db:reset` **erases this local project's database records** and reapplies migrations. It is a development recovery command, not a normal startup step. No command above targets a hosted database.

## Configuration

`.env.example` lists the supported names:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-browser-safe-public-key
```

A valid legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted as a fallback. Prefer the publishable key for a new project. Never supply a secret API key, service-role JWT, database password, or private token to a `NEXT_PUBLIC_` variable. Local environment files are ignored by version control.

For a hosted Supabase project later, apply all three migrations in order, configure the public URL/key, and restart the app. For a production build, these public variables must exist **before** the build; changing them requires a new build. The frontend never silently falls back to local storage for posts. Missing or invalid configuration shows an unavailable state without inventing posts.

## Data and permissions

The migrations are in `supabase/migrations/`:

1. `20261115000100_create_wall.sql` creates `public.posts`, validation constraints, anonymous read/insert policies, an ordering index, and Realtime publication membership.
2. `20261115000200_wall_photos.sql` creates the `wall-photos` bucket and a restricted anonymous upload policy.
3. `20261115000300_visitor_identities.sql` adds browser visitor UUIDs and optional validated display names while preserving existing messages.

Each new post has a submission ID, browser visitor UUID, optional author name, message content, authoritative database timestamp, and optional attachment path. Anonymous callers can insert those input fields but cannot set creation timestamps, edit posts, or delete rows. New anonymous writes require a visitor UUID. Optional names are trimmed, limited to 48 Unicode code points, and reject blank/control-character values at the database boundary; a blank name is saved as `NULL` and displays the visitor label.

The browser stores a random UUID and its optional name preference under `mywall.visitor.v1` in local storage. Anonymous posts display `Visitor #` followed by the first eight hexadecimal characters of that UUID. Reloads and tabs on the same site retain the ID; another browser profile gets a different one. Clearing site data resets it, and private browsing or blocked storage cannot provide permanent cross-session persistence. The app does not fingerprint devices. Names and visitor IDs are convenience labels, not authenticated or verified identities. Existing legacy messages retain their original names and are not assigned invented browser IDs.

Messages use Unicode **code-point** counting, matching PostgreSQL `char_length`. A single emoji can be one code point; a composed emoji can contain several. The composer allows an oversized paste to remain editable, shows an error, and disables Share. It does not split emoji or interrupt input composition. Leading/trailing ECMAScript whitespace is removed before saving; the database independently enforces the same normalization, nonblank content, and the 280-code-point maximum.

The feed initially displays the newest 20 entries and automatically loads another 20 near the bottom of its own scrolling region, using a stable timestamp/ID cursor. A manual load button supports keyboard use. The page, profile, and composer stay in place; a centered Back to latest control appears after scrolling down. New messages preserve the current reading position. Realtime and save responses merge by primary key, preserving database microsecond order. A post arriving during an initial read is retained. Reconnection and returning to the tab reconcile missed entries, including gaps longer than one page. A draft remains intact after a failed save. Retrying the same pending submission reuses its ID instead of blindly creating another row.

The application intentionally supports public, anonymous posting. It does not add login, verified identities, reactions, comments, moderation UI, or an anti-spam service beyond the assignment's scope.

## Photos

Attach JPG, PNG, WebP, or GIF files up to **5 MiB**. The file picker restricts selection to these raster formats. The UI checks size, MIME type, matching file signatures, and successful image decoding before attaching a photo; Supabase separately enforces the bucket size/MIME limits. SVG, documents disguised as photos, and unreadable image files are rejected by the composer. Each upload uses a unique path and never overwrites an object. Image URLs are constructed only for the configured Supabase bucket; arbitrary URL input is not rendered.

The composer previews attachments, supports removal before sharing, and preserves the draft on upload failure. After a successful upload followed by a failed database save, retrying reuses the uploaded object. Shared photos appear as compact thumbnails, at most 200 px wide and 128 px tall, with a link to open the full-size image. A nonblank message is still required.

Photos are public, like the wall. Visitors do not receive storage-listing, update, or deletion policies. If someone abandons a draft after its photo uploaded but its post failed to save, an unreferenced object can remain. Owner maintenance should remove stale unreferenced objects through the privileged Storage API; the browser deliberately receives no broad cleanup privileges. This demo does not run a background cleanup job.

## Profile and presentation

The profile in `src/config/profile.ts` uses Joel Rioflorido's name, Full Stack Developer job, Taguig City, Manila Philippines location, and the supplied image, copied unchanged to `public/joel-rioflorido.png`. Next.js handles responsive image delivery. The two fonts are self-hosted through `next/font/local` from the installed Fontsource packages; visitors do not request fonts from Google. The original reference's biography and conversations are not copied.

Visual tokens and responsive/motion rules live in `src/app/wall.css`. The compact header has no live indicator. The composer and messages share a single bordered panel. The page includes a keyboard skip link, form labels, visible focus, reduced-motion support, character feedback, error recovery, and a simple public-wall layout. `Ctrl+Enter` / `Cmd+Enter` shares a valid message.

## Verification

```sh
npm run check
npm run test:integration
npm run test:e2e
```

- `check`: lint, TypeScript, focused unit/state tests, and a production build.
- `test:integration`: real local Supabase validation, permissions, persistence, Realtime, and Storage checks.
- `test:e2e`: Chrome browser tests covering two independent contexts, posting, refresh, duplicate prevention, input limits, retries, pagination, keyboard interaction, photos, layout widths, and automated accessibility checks.

The integration helpers explicitly require this project's loopback Supabase instance. They use a private local test client only inside test scripts for fixtures/cleanup; no private credential is written into application source or the browser. Browser tests use unique per-run test prefixes and remove their own rows and successful attachments. Synthetic network failures are limited to the test browser; successful persistence and Realtime assertions use the actual local database.

Accessibility automation is a bounded check, not a claim of comprehensive WCAG conformance or screen-reader testing. Supported layout checks include 320, 390, 600, 667, 768, 1024, and 1440 px, including a 667 × 375 landscape view, reduced-motion emulation, and 200% browser page scaling. The 320 × 568 view also covers an attachment and an upload error without outer-page scrolling.

See `docs/redesign-verification.md` for the current design and identity verification, and `docs/verification.md` for the original build's historical results. `docs/screenshots/` contains real app captures. `npm run capture:demo` writes three explicitly authored example notes only if absent, verifies them after reload, and captures desktop/mobile views. They are local verification examples, not fabricated audience activity or automatic production seed data.

## Later submission

The source repository is [2peng23/my-wall](https://github.com/2peng23/my-wall). Deployment and form submission remain separate steps requiring authorization:

1. Keep the GitHub repository updated with source, lockfile, migrations, tests, and documentation; exclude `.env.local`, dependencies, build output, and private traces.
2. Configure an appropriate hosted Supabase project using the migrations and browser-safe environment variables.
3. Import the repository into Vercel and set the public Supabase variables before the production build.
4. Verify the final stable production URL from a fresh browser without Vercel authentication, including real posting, refresh persistence, and live delivery to a second browser.
5. Capture screenshots with a successfully posted message. An optional 30–60 second screen recording can show posting, cross-browser delivery, and refresh persistence.
6. At [the application form](https://apply.capm.us/), select **2) Wall** and supply the public production URL, public repository URL, and required screenshots. Submit only when explicitly authorized.

## Reference and implementation notes

- [Assignment](https://tremendous-tiger-a4a.notion.site/Test-2-My-Wall-React-App-22300bbdfc3b804491bbf6d7f2481cd8)
- [Detailed guide](https://tremendous-tiger-a4a.notion.site/Step-by-Step-Facebook-Wall-Challenge-Test-2-22300bbdfc3b80c3886cd8b22779ed09?pvs=25)
- [Supplied example](https://wall-demo.vercel.app/)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Realtime](https://supabase.com/docs/guides/realtime/postgres-changes), [Storage access](https://supabase.com/docs/guides/storage/security/access-control)

The example's layout informed this implementation. REA observed that example reporting Local Mode, so its cloud behavior was not assumed. The main brief calls the character limit and Realtime optional while the guide lists them as required; both are implemented here. Some linked Notion code/images and Loom playback were inaccessible during research. This is an independent implementation of the verified requirements rather than a claim of exact mockup reproduction.

AI assistance was used for research, implementation, review, and testing, as the assignment permits.
