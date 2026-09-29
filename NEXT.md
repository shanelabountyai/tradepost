# NEXT

Queue, in order:
0. **This item — done: refreshed DEMO.md and the exec brief for the four P1 features, click-tested
   `/admin/reviews`.** Added DEMO.md stops 2a (saved searches), 3a (earnings), 3b (cancellation fee), 6a
   (report + moderate a review); updated its test count and concede list. Exec brief (same URL, now v3)
   dropped the stale "no provider earnings screens" and "no geocoder" claims and added a capabilities-table
   row each for reviews-moderation, cancellation fee, earnings and saved searches. Click-tested the one
   screen no e2e spec covers (`/admin/reviews`): reported a review as the client, resolved it as
   `ops@tradepost.demo.test`, queue went back to empty — works end to end.
   Gate: lint (0 errors, 1 known upstream warning), typecheck clean, `npm test` 232/232 (re-run clean after
   an earlier run showed 3 failures caused by other projects' test sweeps running concurrently on this
   machine — not a real regression, see below), `npm run test:e2e` 10/10.

**Housekeeping note for next time:** a first `npm test` run this session raced against concurrent sweeps
from other project sessions (rental business, alongside) and threw 3 failures in `inv-12-webhooks.test.ts`
(a 500 where 200 was expected — read as lock/connection contention, not code). A clean re-run alone passed
232/232. Matches the existing "cap the connection pool per project" / "never run two sweeps at once"
guidance — check `ps aux | grep vitest` for other projects' runs before trusting a red result.

1. **All four PRD P1 nice-to-haves are done** (D-018, D-022, D-023, D-024), and the two closure docs now
   reflect them. The project is back to closure-deliverable maintenance only (see docs/RELEASE_NOTES.md).
   Nothing queued — check back only if a new PRD item comes in, or if the LinkedIn drafts in the Lab
   Intelligence Ledger need posting now that P1 is demo-ready.

**Upstream candidates** (raise when the foundation repo is next open): the `requireOrg` 404 patch (in
`FOUNDATION_PATCHES.md`). Also: let a clone list its own module-dependent tests for
`foundation:check-modules`; run `beforeDelete` inside its own transaction (D-014); let the INV-01..04
harness express a platform-admin-only action; a `ref`-like tag for an id that is deliberately cross-org
(today such ids are `notRef()`).

**Project status:** all four closure deliverables (D-017) still exist and are current — see
`docs/RELEASE_NOTES.md` for the artifact URLs. Exec brief sharing is still Shane's own step (Share menu on
the artifact page). P0 and all P1 nice-to-haves are complete.

Run one item per session.
