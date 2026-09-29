# NEXT

Queue, in order:
0. **This item — D-021, provider SMS contact number: done.** Details in `docs/decisions.md`. An org-level
   `OrgContact.phone`, set by an owner/admin at `/o/[org]/settings/contact`, rides the existing SMS-capable
   outbox as a second channel alongside `notifyProvider`'s email fan-out. Gate: lint/typecheck/drift/
   check-modules clean, `npm test` 221/221, `npm run test:e2e` 10/10.
1. **Next up — nothing queued from the PRD's P1 list right now.** Re-check `prd-tradepost-marketplace.md`
   for the next P1 item, or ask Shane what's next.

**Upstream candidates** (raise when the foundation repo is next open): the `requireOrg` 404 patch (in
`FOUNDATION_PATCHES.md`). Also: let a clone list its own module-dependent tests for
`foundation:check-modules`; run `beforeDelete` inside its own transaction (D-014); let the INV-01..04
harness express a platform-admin-only action; a `ref`-like tag for an id that is deliberately cross-org
(today such ids are `notRef()`).

**Project status:** all four closure deliverables (D-017) still exist and are current — see
`docs/RELEASE_NOTES.md` for the artifact URLs. Exec brief sharing is still Shane's own step (Share menu on
the artifact page). P0 is complete; this session continued the P1 nice-to-have list from the PRD.

Run one item per session.
