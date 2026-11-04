# NEXT

**Tradepost is closed and live:** https://tradepost.labintelligence.co (shared password = `DEMO_ACCESS_PASSWORD` in
`.env.production.local`), verified 2026-10-03 (D-027). Every closure deliverable exists and is linked in
`docs/RELEASE_NOTES.md`.

Open follow-ups, none blocking:
- **Re-measure Neon about 2026-10-09** (D-026's cost row): `neonctl projects get icy-wave-14607298 --org-id
  org-morning-smoke-06224724 --output json` → `compute_time_seconds`.
- **Template merges bring `audit/` back** (D-028). Delete it in the merge commit before pushing the public repo.
- **Upstream candidates** for when the foundation repo is next open: the `requireOrg` 404 patch and the demo gate
  (`src/proxy.ts`), both in `FOUNDATION_PATCHES.md`; let a clone list its own module-dependent tests for
  `foundation:check-modules`; run `beforeDelete` in its own transaction (D-014); let the INV-01..04 harness express a
  platform-admin-only action; a `ref`-like tag for an id that is deliberately cross-org.

**2026-11-04, foundation upgrade:** saas-foundation v1.3.0 → v1.4.0 (includes v1.3.1, the `security:` release:
next and eslint-config-next 16.3.6 → 16.3.8, due 2026-10-27, late) is on branch `foundation-v1.4.0`, awaiting review
and merge. Ported as a diff (no shared history), like v1.3.0 (PR #1, merged 2026-10-19). Conflicts:
- `src/app/org-hooks.ts`: kept tradepost's `beforeOrgDelete` (D-012/D-014 refusal), added the template's
  `filterListedOrgs` with its default `return orgs`. Tradepost hides no orgs, so no clone test was added.
- `tests/integration/review-2026-10-12-demo.test.ts`: took the template's v1.3.1 text, which now looks the demo org up
  by membership (tradepost's brightline adaptation is no longer needed). Did not take the new
  `review-2026-10-12-demo-projects.test.ts`: tradepost removed `/o/[org]/projects` (D-16, as the changelog says).
- `FOUNDATION_PATCHES.md`: dropped the `inv-12-webhooks.test.ts` row; v1.3.1 ships the identical text upstream.
  The F-04 `guards.ts` patch stays and is the only drift (`foundation:drift` clean against v1.4.0).
No migration. After merge, update tradepost's row in the template's `CLONES.md` to v1.4.1.
**2026-11-04, security:** the same branch now also carries saas-foundation v1.4.1 (next 16.4.5 for the critical Image Optimization RCE, zod 4.6.7, prisma 7.10.1; due 2026-11-11), applied as a diff with no conflicts; redeploy as soon as it merges.
