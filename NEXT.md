# NEXT

Queue, in order:
0. **This item — D-022, cancellation-fee policy tied to lifecycle state: done.** Details in
   `docs/decisions.md`. A client cancelling an accepted job now keeps a 20% cancellation fee for the
   provider (split through the normal release+platform-fee logic); a provider cancelling still refunds
   in full. Gate: lint/typecheck/drift/check-modules clean, `npm test` 223/223, `npm run test:e2e` 10/10.
1. **Next up — two PRD P1 items remain unbuilt:** saved searches + new-match notifications (outbox
   stub, F-20), and an admin moderation queue for reported reviews (F-16). Provider earnings (D-018) and
   cancellation fees (D-022) are the only two P1 items done from the PRD's original four. Pick one, or
   ask Shane which.

**Upstream candidates** (raise when the foundation repo is next open): the `requireOrg` 404 patch (in
`FOUNDATION_PATCHES.md`). Also: let a clone list its own module-dependent tests for
`foundation:check-modules`; run `beforeDelete` inside its own transaction (D-014); let the INV-01..04
harness express a platform-admin-only action; a `ref`-like tag for an id that is deliberately cross-org
(today such ids are `notRef()`).

**Project status:** all four closure deliverables (D-017) still exist and are current — see
`docs/RELEASE_NOTES.md` for the artifact URLs. Exec brief sharing is still Shane's own step (Share menu on
the artifact page). P0 is complete; this session continued the P1 nice-to-have list from the PRD.

Run one item per session.
