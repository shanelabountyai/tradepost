# NEXT

Queue, in order:
0. Feedback run 2 (D-013) and its fix item (D-014): **done**. F-25, F-18, F-30, F-31 and F-33 are fixed.
1. Feedback run (D-008): **done**. Findings are in `docs/FEEDBACK.md`.
2. Fix item (D-009): **done**.
3. Design brief: **done**.
4. Design pass (D-010, D-011): **done**.
5. Fix `e2e/demo.spec.ts`: **done** (D-011). Full e2e 10/10.
6. Foundation upgrade `v1.0.2` + `v1.0.3`: **done** (D-012). Includes a clone fix: provider deletion is refused before
   the subscription is cancelled.
7. **Next: foundation `v1.1.0` + `v1.1.1` merge** (Shane, 2026-09-28: ahead of closure, because v1.1.1 is a `security:`
   release due 2026-10-05 and it may change the sign-in steps in DEMO.md). Opus. Merge both as one item, run the full
   gate, and check `FOUNDATION_PATCHES.md` against what upstream now covers.
8. **Then: closure deliverables.** Four are needed (global CLAUDE.md, *Definition of done*):
   - `docs/DEMO.md` exists. Re-run every command in it once, because the D-011 header and D-012 changes may have moved things.
   - Exec brief `Tradepost in Brief` (the `exec-brief` skill), matched to the sibling briefs.
   - LinkedIn drafts in the Ledger. Mine the "Found" sections in `docs/decisions.md` first.
   - Cost review. Nothing is deployed yet, so record that, plus any crons in `vercel.json`, with keep / slow / off.
   Record every artifact URL in `docs/RELEASE_NOTES.md`.

Waiting upstream: foundation `v1.1.0` (FR-06..11), now tagged, **and `v1.1.1`** (2026-09-28, `security:` — 6 LOWs: stale
sign-in links, TOTP concurrent double-issue, IPv6 rate-limit /64 scoping, orphaned share links, non-atomic audit writes).
`security:` releases are due within 7 days — **v1.1.1 is due 2026-10-05**. Merge both as one upstream-upgrade item.

**Upstream candidates** (raise when the foundation repo is next open): the `requireOrg` 404 patch, and release commits
not bumping `FOUNDATION_VERSION` (v1.0.2 and v1.0.3 both say v1.0.1). Both are in `FOUNDATION_PATCHES.md`. Also: let a
clone list its own module-dependent tests for `foundation:check-modules` (the clone's `org-delete.test.ts` works around
this with a runtime import). From D-014: run `deleteOrg`'s `beforeDelete` inside its transaction, and let the
INV-01..04 harness express a platform-admin-only action.

Run one item per session.
