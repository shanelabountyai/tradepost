# NEXT

Queue, in order:
0. **This item — D-023, saved searches + new-match notifications: done.** Details in `docs/decisions.md`.
   A client saves a search from `/search` (`/searches` lists and removes them); a cron pass
   (`matchNewSavedSearches` in `src/lib/saved-searches.ts`, wired into `src/app/cron-jobs.ts`) emails once
   per pass when a new listing matches, via the existing outbox. Gate: lint/typecheck/drift/check-modules
   clean, `npm test` 227/227, `npm run test:e2e` 10/10.
1. **Next up — one PRD P1 item remains unbuilt: admin moderation queue for reported reviews (F-16).**
   Provider earnings (D-018), cancellation fees (D-022) and saved searches (D-023) are the three P1 items
   done from the PRD's original four; F-16 is the last one. After it, all four P1 nice-to-haves are done
   and the project is back to closure-deliverable maintenance only (see docs/RELEASE_NOTES.md).

**Upstream candidates** (raise when the foundation repo is next open): the `requireOrg` 404 patch (in
`FOUNDATION_PATCHES.md`). Also: let a clone list its own module-dependent tests for
`foundation:check-modules`; run `beforeDelete` inside its own transaction (D-014); let the INV-01..04
harness express a platform-admin-only action; a `ref`-like tag for an id that is deliberately cross-org
(today such ids are `notRef()`).

**Project status:** all four closure deliverables (D-017) still exist and are current — see
`docs/RELEASE_NOTES.md` for the artifact URLs. Exec brief sharing is still Shane's own step (Share menu on
the artifact page). P0 is complete; this session continued the P1 nice-to-have list from the PRD.

Run one item per session.
