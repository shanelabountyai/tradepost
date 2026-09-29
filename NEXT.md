# NEXT

Queue, in order:
0. **This item — D-024, admin moderation queue for reported reviews (F-16): done.** Details in
   `docs/decisions.md`. The party a published review is about reports it from the job's review panel; a
   platform admin keeps or removes it at `/admin/reviews`; removing a client's review takes its stars out of
   the pro's rating. Gate: lint/typecheck/drift/check-modules clean, `npm test` 232/232, `npm run test:e2e` 10/10.
1. **All four PRD P1 nice-to-haves are now done** (D-018, D-022, D-023, D-024). The project is back to
   closure-deliverable maintenance only (see docs/RELEASE_NOTES.md). Worth doing next: refresh the exec brief
   and DEMO.md with the four P1 features, and a quick browser click-through of `/admin/reviews` and the report
   form (no e2e spec covers them).

**Upstream candidates** (raise when the foundation repo is next open): the `requireOrg` 404 patch (in
`FOUNDATION_PATCHES.md`). Also: let a clone list its own module-dependent tests for
`foundation:check-modules`; run `beforeDelete` inside its own transaction (D-014); let the INV-01..04
harness express a platform-admin-only action; a `ref`-like tag for an id that is deliberately cross-org
(today such ids are `notRef()`).

**Project status:** all four closure deliverables (D-017) still exist and are current — see
`docs/RELEASE_NOTES.md` for the artifact URLs. Exec brief sharing is still Shane's own step (Share menu on
the artifact page). P0 is complete; this session continued the P1 nice-to-have list from the PRD.

Run one item per session.
