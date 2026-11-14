# My Wall implementation

Local-only work. No GitHub publication, Vercel linking, deployment, or hiring-form submission.

The subsequent requested modern redesign replaces the original retro styling, uses Joel's supplied photo, and adds persistent visitor IDs and optional names. See [redesign-verification.md](redesign-verification.md) for the current result.

1. Establish React 19 / Next.js / Tailwind / React shadcn and a real isolated local Supabase project.
2. Implement posts schema, anonymous read/insert permissions, authoritative timestamps, validation, and Realtime.
3. Build a reference-informed wall, complete composer, chronological paged feed, feedback, and recovery.
4. Verify real browser-to-database persistence and synchronization, input edge cases, permissions, and mobile accessibility.
5. Finish optional attachments only after the text flow passes; capture real screenshots and document setup.

## Gates

- [x] Anonymous post saves to Supabase and survives reload / an independent browser.
- [x] 280-code-point validation agrees with the database, including Unicode whitespace.
- [x] Initial 50 posts, stable ordering, older-page access, Realtime deduplication and reconciliation.
- [x] Recoverable errors preserve drafts; missing configuration never creates fake success.
- [x] Browser interaction, responsive/keyboard accessibility, lint, types, build and meaningful tests pass.
- [x] Database migration, local setup, verification evidence and final screenshots are documented.

The optional photo bonus is also complete and verified. See [verification.md](verification.md) for actual results and remaining external deployment steps.

## Reference

The supplied example at https://wall-demo.vercel.app/ was observed through REA (evidence `ev_c4ad2954be4f10f151299f0e79ea2c72e53631fb850df462203b924f1199e2cb`). It shows a blue masthead, profile sidebar, composer, and divider-separated posts. It reports Local Mode. Its owner identity and sample conversations are not used. Our actual database is Supabase, running locally in Docker.
