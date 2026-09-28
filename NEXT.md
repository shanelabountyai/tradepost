# NEXT

Queue, in order:
0. **This item — D-019, job-request/message email notifications: done.** Details in `docs/decisions.md`.
   Turned out to be wiring three call sites into an outbox pipeline that already shipped with v1.2.0
   (D-016) and was already drained hourly — not building one. Gate: lint/typecheck/drift/check-modules
   clean, `npm test` 215/215, `npm run test:e2e` 10/10.
1. **Next up — geocoded address entry on the listing form** (street/zip → lat/lng server-side) instead
   of raw lat/lng inputs. Contractor-persona review (D-018), sized as its own item.
2. A phone-number field for provider contact (member profile) — same review, small, separate item. The
   outbox already supports SMS (`sendSms` in `src/modules/notifications/sms.ts`); once a phone number
   exists this could ride the same `notifyProvider`/`notifyClient` pattern from D-019 (`src/lib/notify.ts`)
   as a second channel — not scoped in yet, just noting the seam.

**Upstream candidates** (raise when the foundation repo is next open): the `requireOrg` 404 patch (in
`FOUNDATION_PATCHES.md`). Also: let a clone list its own module-dependent tests for
`foundation:check-modules`; run `beforeDelete` inside its own transaction (D-014); let the INV-01..04
harness express a platform-admin-only action; a `ref`-like tag for an id that is deliberately cross-org
(today such ids are `notRef()`).

**Project status:** all four closure deliverables (D-017) still exist and are current — see
`docs/RELEASE_NOTES.md` for the artifact URLs. Exec brief sharing is still Shane's own step (Share menu on
the artifact page). P0 is complete; this session continued the P1 nice-to-have list from the PRD.

Run one item per session.
