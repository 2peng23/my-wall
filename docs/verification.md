# Verification record

This records the original build before the modern redesign and optional visitor names. Current behavior and checks are documented in [redesign-verification.md](redesign-verification.md).

Verified November 15, 2026 (Asia/Manila). This is a local implementation; no GitHub repository was published, no Vercel project was linked or deployed, and the hiring form was not submitted.

## Environment

- Node.js 24.22.3; Next.js 16.4.6; React 19.3.1; Tailwind CSS 4.3.5; Supabase client 2.119.0 / CLI 3.1.0.
- Real project-specific local Supabase services: Postgres, PostgREST, Realtime, Storage, Auth gateway, and Kong in Docker.
- Browser verification: installed Google Chrome, automated through Playwright and REA. Independent browser contexts have separate storage.
- Main development preview: `http://127.0.0.1:3000`. A separate production build was tested locally on port 3001, then stopped after verification.

## Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| ESLint | Passed, no warnings | `npm run lint` |
| TypeScript | Passed | `npm run typecheck` |
| Unit/state tests | 17 passed across 3 files | `npm test` |
| Real database integration | 8 checks passed | `scripts/verify-database.mjs` |
| Real Storage integration | 4 checks passed | `scripts/verify-storage.mjs` |
| Browser tests | 11 passed | `npm run test:e2e` |
| Production build | Passed | `npm run build` (also included in `npm run check`) |
| Build without configuration | Passed | Production build with all public Supabase settings explicitly empty |

The missing-configuration production build was also opened in Chrome: it showed an unavailable wall, zero invented post rows, and disabled sharing. The final production build was then regenerated with the local public settings and its real Share interaction was exercised through REA.

## Behavior coverage

| Requirement | Verified behavior |
| --- | --- |
| B01 Anonymous access | Fresh browser contexts open, read, and post without an account. |
| B02 Validation | Empty/whitespace content rejected; exact 280-code-point emoji messages accepted; 281 rejected in both UI/database; oversized input remains editable. |
| B03 Confirmed sharing | Real INSERT result renders once; rapid double activation creates one row; draft clears after confirmed success. |
| B04 Ordering/pagination | First 50 loaded, older entries reachable, deterministic timestamp ties; microsecond ordering has a focused unit regression test. |
| B05 Persistence | Reload and a separate context read the real saved row; observer local storage remains empty. |
| B06 Realtime | Actual database INSERT reaches another browser; sender event is deduplicated; unit tests cover delayed reads, reconnect reconciliation across multiple pages, and subscription cleanup. |
| B07 Recovery | Controlled read/write failures differ from an empty wall; drafts survive errors; offline feedback appears and posting recovers without reload. |
| B08 Rendering | Script-like text is rendered harmlessly; keyboard-only submission works; CSS wraps long message content. |
| B09 Retry integrity | Lost-response reconciliation and reuse of a pending submission ID are tested. This is not an unconditional exactly-once-delivery guarantee. |
| B10 Responsive/accessibility | No horizontal overflow at 320, 390, 600, 768, 1024, and 1440 px; keyboard focus/skip link and reduced motion verified; 200% page scaling checked. |
| Photo bonus | Real upload, preview/removal, persisted image, second-context retrieval, rejected type/size, upload failure, and reuse after a failed post save all passed. |
| Database permissions | Anonymous callers cannot forge author/timestamp, update/delete posts, overwrite/delete stored photos, or bypass message constraints. |

Automated axe checks found no violations for the selected WCAG A/AA tags in the tested populated desktop and phone states. This is bounded evidence, not a comprehensive accessibility-conformance or screen-reader claim. Layouts and captures were inspected visually; other browser engines and physical phones were not tested.

## MCP evidence

- REA reference capture: `ev_c4ad2954be4f10f151299f0e79ea2c72e53631fb850df462203b924f1199e2cb` (supplied demo reports Local Mode).
- REA initial local wall: `ev_717ef21f4719c9d692150124a71afd6ea5d956fb46367145aaedc98186763dbd` (real empty database, live connection, no captured page errors).
- REA final local production Share: `ev_c8f28c810781347baf8df7abdefcc618975c5838f83d60dc9fd54d1dad608f51`. All scenario steps completed: load, fill, Share, confirm. The saved note appeared, the composer cleared, success status was announced, and no page-error events were captured. Portable provider evidence: [rea-production-share.json](evidence/rea-production-share.json).
- AestheticForge compiled the assignment's visual contract and inspected 390, 600, 768, and 1440 px layouts. It reported no horizontal overflow or element overlap and found labeled controls. Its small-target heuristic flagged the intentionally clipped native file input; the actual visible Add a photo button is the keyboard/touch trigger and was exercised in browser tests. This is an interpreted tool finding, not a claimed exhaustive usability assessment.
- React shadcn components were generated with the official React CLI after detecting that the exposed MCP add-command description was for Vue. No Vue components were installed. CSS handles the restrained feedback animation; no additional animation engine was necessary.

## Captures and retained notes

- [Desktop screenshot](screenshots/desktop.png)
- [Phone screenshot](screenshots/mobile.png)

The retained `Visitor` notes were actually submitted to the local database through the UI during this task. They are clearly authored local review examples, not fabricated user activity, imported reference conversations, or a production seed. The capture script can reproduce the screenshots without duplicating its three specific notes. An additional note was posted by the final REA production check.

## Limits and next steps

- Hosted Supabase and a public production URL have not been configured or tested; those are deferred with deployment as requested.
- Public repository publication and the hiring submission remain undone by instruction.
- Photo uploads can leave an orphan if an uploaded-but-unsaved draft is abandoned. Anonymous deletion is intentionally unavailable; owner maintenance through the Storage API is documented in the README.
- A separate edited demo video is optional and was not produced. The required screenshots and source/setup materials are ready.
- Some linked Notion code/images and Loom playback were inaccessible during reference research. The delivered UI follows the verified brief and observed supplied demo, without a claim of exact inaccessible-mockup fidelity.
