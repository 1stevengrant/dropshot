# Dropshot web

A Cloudflare Worker that serves `d.ghijk.nz`. It shows drop pages, serves files from R2, and hosts the dashboard at the root.

| Path | What it is | Who can see it |
| --- | --- | --- |
| `/` | Dashboard library, with filters as query strings (`/?tag=note&page=2`) | Only you; signed out visitors go through `/app` |
| `/<id>` | Drop page; you get the management view at the same address | Depends on the drop's privacy |
| `/<id>+` and `/<id>/<filename>` | The raw file, with range support for video | Depends on the drop's privacy |
| `/<id>/embed` | Chrome free page for iframes | Depends on the drop's privacy |
| `/app` | Cloudflare Access sign in entry; forwards to the same view at `/` | Only you, through Cloudflare Access |
| `/api` | JSON API used by the dashboard | Only you, through Cloudflare Access |

Drop metadata (titles, tags, boards, privacy, passwords, expiry, views) lives in D1. The Mac app keeps uploading straight to R2; the Worker registers new objects whenever the dashboard loads, when an unknown drop is requested, and every five minutes from a cron trigger. The same cron deletes expired drops from R2 and D1.

## Privacy rules

* Public: anyone with the link.
* Password: visitors enter a password once per drop (stored as a PBKDF2 hash, unlocked with a signed cookie).
* Private: only you, signed in through Access.
* Self destruct: after the expiry time the drop returns 410 and is deleted within five minutes.
* Download permission off: no download button, and `?download=1` requests are refused for visitors.

## Development

```bash
npm install
npm run build                 # builds the dashboard into dist/app
npx wrangler d1 migrations apply dropshot --local
npm run dev                   # http://localhost:8787
```

`.dev.vars` sets `DEV_OWNER=1`, which treats every local request as the owner. Send `X-Dev-Visitor: 1` to test as a visitor. Never set `DEV_OWNER` on the deployed Worker.

## Deploying

```bash
npm run migrate               # applies D1 migrations to the remote database
npm run deploy
```

## Cloudflare Access

Create a self hosted Access application in Zero Trust for `d.ghijk.nz/app` and `d.ghijk.nz/api`, with a policy that allows your email. Then put the team domain (for example `yourteam.cloudflareaccess.com`) and the application audience tag into `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` in `wrangler.jsonc` and deploy again. The Worker verifies the Access token itself, so the dashboard stays locked if either value is missing.
