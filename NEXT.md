# NEXT

Queue, in order:
0. Feedback run 2 (D-013) and its fix item (D-014): **done**. F-25, F-18, F-30, F-31 and F-33 are fixed.
1. Feedback run (D-008): **done**. Findings are in `docs/FEEDBACK.md`.
2. Fix item (D-009): **done**.
3. Design brief: **done**.
4. Design pass (D-010, D-011): **done**.
5. Fix `e2e/demo.spec.ts`: **done** (D-011). Full e2e 10/10.
6. Foundation upgrade `v1.0.2` + `v1.0.3`: **done** (D-012).
7. Foundation `v1.1.0` + `v1.1.1` + `v1.2.0` merge: **done** (D-016). 212/212, e2e 10/10.
8. Closure deliverables (D-017): **done**.
   - `docs/DEMO.md` re-run clean, and its stale "168 tests" / "no styling pass" lines fixed.
   - Exec brief `Tradepost in Brief` verified and republished (v2): https://claude.ai/artifact/C5N7FvEoizZszzzszTLc2Q
   - LinkedIn drafts (3 new, bug-hunting angles) added to the Ledger: https://claude.ai/artifact/Ai5xKScgT2sWtqXRQ1ZA8i
   - Cost review: nothing deployed, $0/month baseline.
   - Artifact URLs recorded in `docs/RELEASE_NOTES.md`.

**Not yet closed — the one thing only Shane can do:** the exec brief is still private. Share it from the page's
Share menu before the queued Tradepost LinkedIn posts (which link to it) go out.

**Upstream candidates** (raise when the foundation repo is next open): the `requireOrg` 404 patch (in `FOUNDATION_PATCHES.md`).
Also: let a clone list its own module-dependent tests for `foundation:check-modules`; run `beforeDelete` inside its
own transaction (D-014); let the INV-01..04 harness express a platform-admin-only action; a `ref`-like tag for an id
that is deliberately cross-org (today such ids are `notRef()`).

**Project status:** all four closure deliverables exist. The repo, tests and docs are in good shape to demo or
hand off. No further items queued — the next session can start something new or extend Tradepost past P1.

Run one item per session.
