# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Dropshot is a self hosted rebuild of Droplr with two halves that share one R2 bucket, plus a Chrome extension:

* `Dropshot/`: a Swift 6 menu bar app for macOS 15+ that captures and uploads straight to S3 compatible storage.
* `web/`: a Cloudflare Worker (Hono, D1, R2, Cloudflare Access) serving `d.ghijk.nz`. It shows public drop pages and hosts the owner's React dashboard.
* `extension/`: a Manifest V3 Chrome extension that captures the current tab's full page and uploads it through `/api/upload`, using the browser's Cloudflare Access session (no token of its own).

`re/SPEC.md` is the behavioural spec reverse engineered from Droplr 5.9.19. Everything else in `re/` is gitignored decompiler output and must stay out of git. `import/` holds the one-off Droplr importer (its data files and token are gitignored).

## Commands

Mac app (run from the repo root; `Dropshot.xcodeproj` is generated from `project.yml` and gitignored):

```bash
xcodegen generate
xcodebuild -project Dropshot.xcodeproj -scheme Dropshot -derivedDataPath build build
xcodebuild -project Dropshot.xcodeproj -scheme Dropshot -derivedDataPath build test
xcodebuild ... test -only-testing:DropshotTests/S3SignerTests/testName   # single test
```

Web (run from `web/`):

```bash
npm run typecheck        # tsc, covers worker, dashboard and shared types
npm run build            # Vite dashboard into dist/app, plus Tailwind CLI for dist/_assets/public.css
npm run dev              # wrangler dev on :8787 (build first; the Worker serves dist/)
npm run dev:app          # Vite dev server for the dashboard, proxying /api to :8787
npx wrangler d1 migrations apply dropshot --local
npm run migrate          # remote D1 migrations
npm run deploy           # build + wrangler deploy (production, live domain)
```

Extension (run from `extension/`): `npm run build` writes `dist/`, which is loaded unpacked from `chrome://extensions`; `npm run typecheck` checks it.

There is no web test suite. Verify Worker changes with `wrangler dev` and curl. `.dev.vars` sets `DEV_OWNER=1` so every local request is the owner; send the header `X-Dev-Visitor: 1` to act as a visitor. Never set `DEV_OWNER` on the deployed Worker.

## Architecture

### How a drop comes into existence

The Mac app signs its own S3 requests (`Upload/S3Signer.swift`, CryptoKit SigV4) and writes objects as `<id>/<filename>` (or `<id>.<ext>` in short ID mode). Files over 64 MB go up as S3 multipart uploads in 32 MB parts (`S3MultipartUpload.swift`). It never talks to the Worker. The Worker discovers new objects in `worker/bucketSync.ts`, which lists the bucket and inserts missing rows into D1. Sync runs from the cron (every five minutes, `scheduled.ts`), in the background via `waitUntil` when the dashboard loads (throttled by `syncIfStale`, because concurrent R2 lists fail with error 10058), and when an unknown ID is requested. Keys starting with `_` are ignored. Drops created from the dashboard (uploads, short links, notes) go through `/api` and are written to D1 directly. A Worker request body is capped at 100 MB, so dashboard files over 25 MB are sent in parts through `/api/uploads` (R2 multipart, see `lib/chunkedUpload.ts`); `/api/upload` is only for small files.

The drop ID is the first path segment, and the share link is `https://d.ghijk.nz/<id>`. The Mac app copies that link, not the object URL.

### Worker routing (`web/src/worker/index.ts`)

Route order is significant. Specific routers are mounted first, then the `/:id` catch alls, with `<id>+` (raw file) before `/:id`. One URL serves two audiences:

* `/` is the dashboard library for the owner. Visitors are redirected to `/app`, which is the only path (with `/api`) behind Cloudflare Access. `/app/*` forwards to the root equivalent.
* `/<id>` returns the React shell for the owner (management view) and a server rendered public page for everyone else; `?preview` forces the public page.

Owner detection (`auth/`): the Access JWT is verified in the Worker (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` in `wrangler.jsonc`), but Access only sends it under `/app` and `/api`. `ownerOnly` therefore also sets a signed `dropshot_owner` cookie (secret `OWNER_COOKIE_SECRET`) so the owner is recognised on share links. Ownership is a single boolean; there is no users table.

Request scoped services (`Drops`, `BucketSync`, boards, tags, visits) are attached in `middleware/withDrops.ts` and read with `c.get(...)`; the context type lives in `app.ts`.

### Drop lifecycle

Privacy (public, password, private), self destruct expiry, download permission and CTA live in D1 (`migrations/`). Deleting a drop is a soft delete (`deleted_at`): trashed drops return 410 to visitors, are excluded from lists, tag and board counts, and are purged from R2 and D1 by the cron after 30 days. Expired drops are moved to the trash by the same cron. Purge only ever acts on trashed drops.

### Front ends

* `web/src/app`: React 19 dashboard (react-router, TanStack Query, daisyUI 5 on Tailwind 4). Vite `root` is `src/app` with `base: '/app/'`, so built assets live under `/app/assets` even though routes are at the root. Dialogs render through `components/Modal.tsx` (a portal) because the pinned, blurred toolbar would otherwise trap fixed elements. `lib/libraryLocation.ts` remembers the library URL so back and delete return to the same tag and page.
* `web/src/worker/pages`: public pages rendered as HTML strings in the Worker, styled by a separate Tailwind build (`src/public/public.css`, which scans only `worker/pages`).
* `web/src/theme.css`: the shared `dropshot` and `dropshot-dark` daisyUI themes used by both.
* `web/src/shared/types.ts`: API types shared by the Worker and dashboard.

### Mac app

XcodeGen project with `SWIFT_DEFAULT_ACTOR_ISOLATION: MainActor` for the app and `nonisolated` for tests. Screenshots shell out to `/usr/sbin/screencapture` rather than a custom overlay. Recordings use ScreenCaptureKit (`Capture/Recording/`): `RecordingRegionPicker` chooses an area, window or display, `ScreenRecorder` runs the session (idle, countdown, recording, paused, finishing) and `RecordingWriter` writes the stream with `AVAssetWriter`, dropping paused samples and shifting later timestamps by the paused time (`RecordingClock`). The control bar and countdown set `sharingType = .none`, so they never appear in a recording. The camera bubble is let in with `RecordingTarget.including`, which excludes Dropshot and excepts the bubble: ScreenCaptureKit's "excepting" windows only re-include windows of an excluded app, and leave them out otherwise. Storage credentials are kept in the Keychain; other settings in `Settings/Preferences.swift`. The only dependency is KeyboardShortcuts (SPM).

## Conventions

* One responsibility per file in both the Worker and the dashboard (one component, router, page or helper per file). Follow that when adding code.
* Everything in the UI uses daisyUI components and the theme tokens in `theme.css`; avoid ad hoc colours.
* Dashboard confirmations use `ConfirmDialog`, never `window.confirm`.
* Code drops are recognised by file extension. The list lives twice, in `web/src/shared/codeLanguages.ts` and `Dropshot/Drops/CodeLanguage.swift`; change both together. Highlighting runs through `web/src/shared/highlightCode.ts`, server side for public pages and lazily loaded in the dashboard.
* Full page web captures scroll one viewport at a time and stitch the tiles (never grow the viewport, which stretches `100vh` sections). The logic lives three times: `Dropshot/Capture/WebPageCapture.swift`, `web/src/worker/screenshots/` and `extension/src/`; change them together.
* Docs and READMEs avoid dashes as punctuation.
* `/_import` only works while the `IMPORT_TOKEN` secret exists; it has been deleted, so the importer is off.
