# Production deployment verification

Verified on November 15, 2026 (Asia/Manila).

- Public production URL: [My Wall](https://my-wall-gamma-sandy.vercel.app)
- Source: [2peng23/my-wall](https://github.com/2peng23/my-wall)
- Deployed application commit: [`db7adb7`](https://github.com/2peng23/my-wall/commit/db7adb7eaf4aec6550fe1c371abdc6930abd60c0)
- Vercel project: `my-wall`, in `riorios-projects`
- Production deployment: `dpl_D8VLfiEYZppz44aBT5SBnpo2L3iW`, READY
- Runtime: Node.js `24.x`, pinned in the project settings, package manifest and lockfile
- Hosted backend: Supabase project `aqtzwmwbihhigzdaglrg`, Singapore

## Verified flow

An anonymous visitor writes a message, optionally supplies a name and photo, and submits through the public Vercel site. The browser uploads the photo to hosted Supabase Storage, inserts the post into hosted Postgres, and receives actual Supabase Realtime events in another browser.

| Boundary                   | Evidence                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Public access              | HTTP 200 from fresh anonymous browsers; no Vercel login or protection bypass                                                               |
| UI to database             | Share submitted a real post through the hosted Data API; response contained its saved ID, author, browser UUID and attachment path         |
| UI to Storage              | A real PNG uploaded through the composer; the public photo returned HTTP 200 and matched the original file's SHA-256                       |
| Realtime to second browser | The second independent context received the message and photo after subscription; its Data API read count did not increase during delivery |
| Persistence                | Message and photo remained after reloading both browsers; a separate anonymous database read confirmed the saved record                    |
| Browser identity           | The posting browser retained its visitor label and optional name after reload                                                              |
| Layout                     | Desktop 1440 × 1000 and phone 390 × 844 stayed within the viewport                                                                         |
| Browser errors             | No page errors or failed network requests during the checks                                                                                |
| Deployment                 | Vercel completed the production build, TypeScript step and alias assignment                                                                |
| Vercel error log scan      | No matching error/fatal entries for this deployment during the checked 30-minute window                                                    |

The two browser contexts had independent storage. The successful Realtime delivery did not depend on polling, returning focus to the page, or reloading the observer.

## Data and setup

All three repository migrations were applied to the dedicated hosted project. They configure post constraints, anonymous read/insert policies, the Realtime publication, browser visitor identities, optional names, and the public `wall-photos` bucket with raster-format and 5 MiB limits.

The seven existing local messages and their two attached photos were copied to production, retaining their IDs, attribution, timestamps and attachment paths. Each copied photo was checked against its local original. Local Docker data was retained.

Each production browser check created a uniquely identified temporary message and photo. Cleanup matched that run's exact ID, visitor UUID, author, content and photo path; it removed only the owned test data. The final fresh-browser check found the original seven messages and both photos, with no temporary verification posts.

Vercel receives only the browser-safe Supabase URL and publishable key. Database credentials, private setup results, local environment files and project-link metadata remain ignored by Git. Local development keeps its separate loopback Supabase settings.

## Checks and evidence

- `npm run check`: lint and TypeScript passed; 28 unit/state tests passed; production build passed.
- [Machine-readable live results](evidence/production-deployment.json)
- [Clean live desktop screenshot](screenshots/live-desktop.png)
- [Clean live phone screenshot](screenshots/live-mobile.png)

The application was deployed from an explicit GitHub commit through Vercel MCP. Automatic deployments from future Git pushes are not configured; application changes require a separate deployment. Later documentation-only commits do not change the deployed application.

These are bounded Chrome checks, not continuous monitoring or a claim of comprehensive browser/accessibility coverage. No hiring-form submission was performed.
