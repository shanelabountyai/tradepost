# NEXT

Queue, in order:
0. **This item — D-018, provider earnings dashboard + real org home: done.** Details in `docs/decisions.md`.
   Gate: lint/typecheck/drift/check-modules clean, `npm test` 214/214, `npm run test:e2e` 10/10.
1. **Next up — job-request / message notifications (email, minimum).** Flagged by a contractor-persona
   review as the #1 real gap: a provider only learns about a new request or message by having the app tab
   open and polling. No email/SMS code exists anywhere in `src` today. Touches `src/lib/jobs.ts`
   (`transition()`) and the message-send actions in `src/lib/threads.ts` / `.../jobs/actions.ts`.
2. Geocoded address entry on the listing form (street/zip → lat/lng server-side) instead of raw
   lat/lng inputs — same contractor review, sized as its own item.
3. A phone-number field for provider contact (member profile) — same review, small, separate item.

**Upstream candidates** (raise when the foundation repo is next open): the `requireOrg` 404 patch (in
`FOUNDATION_PATCHES.md`). Also: let a clone list its own module-dependent tests for
`foundation:check-modules`; run `beforeDelete` inside its own transaction (D-014); let the INV-01..04
harness express a platform-admin-only action; a `ref`-like tag for an id that is deliberately cross-org
(today such ids are `notRef()`).

**Project status:** all four closure deliverables (D-017) still exist and are current — see
`docs/RELEASE_NOTES.md` for the artifact URLs. Exec brief sharing is still Shane's own step (Share menu on
the artifact page). P0 is complete; this session started on the P1 nice-to-have list from the PRD.

Run one item per session.
