# NEXT

**Tradepost is closed and live:** https://tradepost.labintelligence.co (shared password = `DEMO_ACCESS_PASSWORD` in
`.env.production.local`), verified 2026-10-03 (D-027). Every closure deliverable exists and is linked in
`docs/RELEASE_NOTES.md`.

Open follow-ups, none blocking:
- **Re-measure Neon about 2026-10-09** (D-026's cost row): `neonctl projects get icy-wave-14607298 --org-id
  org-morning-smoke-06224724 --output json` → `compute_time_seconds`.
- **Reconnect Vercel Git** (D-028): the repo was deleted and recreated, so reconnect it in project `tradepost` → Settings → Git,
  and check the deploy hook still fires.
- **Template merges bring `audit/` back** (D-028). Delete it in the merge commit before pushing the public repo.
- **Upstream candidates** for when the foundation repo is next open: the `requireOrg` 404 patch and the demo gate
  (`src/proxy.ts`), both in `FOUNDATION_PATCHES.md`; let a clone list its own module-dependent tests for
  `foundation:check-modules`; run `beforeDelete` in its own transaction (D-014); let the INV-01..04 harness express a
  platform-admin-only action; a `ref`-like tag for an id that is deliberately cross-org.
