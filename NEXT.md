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
7. Foundation `v1.1.0` + `v1.1.1` + `v1.2.0` merge: **done** (D-016). 212/212, e2e 10/10.
8. **Next: closure deliverables.** Sonnet fits (docs and artifacts, no new logic); Opus for the cost review if it gets fiddly. Four are needed (global CLAUDE.md, *Definition of done*):
   - `docs/DEMO.md` exists. Re-run every command in it once, because the D-011 header and D-012 changes may have moved things.
   - Exec brief `Tradepost in Brief` (the `exec-brief` skill), matched to the sibling briefs.
   - LinkedIn drafts in the Ledger. Mine the "Found" sections in `docs/decisions.md` first.
   - Cost review. Nothing is deployed yet, so record that, plus any crons in `vercel.json`, with keep / slow / off.
   Record every artifact URL in `docs/RELEASE_NOTES.md`.

**Upstream candidates** (raise when the foundation repo is next open): the `requireOrg` 404 patch (in `FOUNDATION_PATCHES.md`).
The `FOUNDATION_VERSION` bump is fixed upstream as of v1.2.0. Also (partly met by v1.2.0's `required-modules.ts`, which covers a module the app needs, not a test): let a
clone list its own module-dependent tests for `foundation:check-modules` (the clone's `org-delete.test.ts` works around
this with a runtime import). From D-014: run `deleteOrg`'s `beforeDelete` inside its transaction, and let the
INV-01..04 harness express a platform-admin-only action. From D-016: a `ref`-like tag for an id that is
deliberately cross-org (today such ids are `notRef()`).

Run one item per session.
