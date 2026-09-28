# NEXT

Queue, in order:
1. Feedback run (D-008): **done**. Findings are in `docs/FEEDBACK.md`.
2. Fix item (D-009): **done**.
3. Design brief: **done**.
4. Design pass (D-010, D-011): **done**.
5. Fix `e2e/demo.spec.ts`: **done** (D-011). Full e2e 10/10.
6. Foundation upgrade `v1.0.2` + `v1.0.3`: **done** (D-012). Includes a clone fix: provider deletion is refused before
   the subscription is cancelled.
7. **Next: closure deliverables.** Four are needed (global CLAUDE.md, *Definition of done*):
   - `docs/DEMO.md` exists. Re-run every command in it once, because the D-011 header and D-012 changes may have moved things.
   - Exec brief `Tradepost in Brief` (the `exec-brief` skill), matched to the sibling briefs.
   - LinkedIn drafts in the Ledger. Mine the "Found" sections in `docs/decisions.md` first.
   - Cost review. Nothing is deployed yet, so record that, plus any crons in `vercel.json`, with keep / slow / off.
   Record every artifact URL in `docs/RELEASE_NOTES.md`.

Waiting upstream: foundation `v1.1.0` (FR-06..11). Merge it as its own item once it is tagged.

**Upstream candidates** (raise when the foundation repo is next open): the `requireOrg` 404 patch, and release commits
not bumping `FOUNDATION_VERSION` (v1.0.2 and v1.0.3 both say v1.0.1). Both are in `FOUNDATION_PATCHES.md`.

Run one item per session.
