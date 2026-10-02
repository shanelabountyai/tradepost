# NEXT

**In flight: the first production deploy (D-026).** Code, the Neon project, the Vercel project, the domain and the
deploy hook are all in place. What's left:

1. **Shane runs** `bash scripts/deploy-prod.sh` in his own terminal. It asks for the demo password, sets the
   Vercel production env and `.env.production.local`, migrates and seeds Neon, adds the Cloudflare A record and fires
   the `main-manual` hook. (A session is refused env writes, DNS and production deploys.)
2. **Then a session verifies** `https://tradepost.labintelligence.co`: 401 without the password on `/`, `/demo`,
   `/api/health`; 200 with it; `/demo` signs in as the Brightline owner, the client and `ops@`; `/api/cron` refuses
   without its secret. If DNS is slow, query TXT as well as A to tell "not saved" from "not out yet" (callboard's note).
3. **Then record the live URL** in `WRITEUP.md` (the "Live demo" line), `docs/RELEASE_NOTES.md`, `docs/DEMO.md` (a
   "live" section: the URL, and the password lives in `.env.production.local`), and the build log's `live` field
   (https://claude.ai/artifact/28KeGV3xfBwcBuoMEQjFMj, row `marketplace`).

Done this session: `WRITEUP.md` (now linked in the build log is pending: update its `writeup` field in step 3 too).
Gate: lint, typecheck, drift clean; `npm test` 235/235; `npm run test:e2e` 10/10; the gate checked on a local production
build (401 / 200 as expected).

**Upstream candidates** (raise when the foundation repo is next open): the `requireOrg` 404 patch and the demo gate
(`src/proxy.ts`), both in `FOUNDATION_PATCHES.md`. Also: let a clone list its own module-dependent tests for
`foundation:check-modules`; run `beforeDelete` inside its own transaction (D-014); let the INV-01..04 harness express a
platform-admin-only action; a `ref`-like tag for an id that is deliberately cross-org.
