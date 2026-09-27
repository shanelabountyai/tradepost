# NEXT

> **Foundation upgrade waiting (2026-09-27): `v1.0.2`** — FR-01 outbox fix (send no longer inside the claim tx; a slow provider
> was delivered but never recorded, then re-sent every cron run). `git fetch template --tags && git merge v1.0.2`, no migration;
> re-run your outbox tests (a clone that wraps `drainOutbox` or its transports may conflict). v1.1.0 (FR-02..11) follows.

Queue, in order:
1. Feedback run (D-008): **done**. Findings are in `docs/FEEDBACK.md`.
2. Fix item (D-009): **done**.
3. Design brief: **done**. F-03, F-06, F-12, F-13, F-19 and the two D-009 states are folded into `docs/DESIGN_BRIEF.md`.
4. **Waiting on Shane: paste `docs/DESIGN_BRIEF.md` into Claude Design** (D-010) and bring back the link or export.
5. **Next session: review the Claude Design output against the brief** (Opus). Check every state in "States that must be
   designed", the fee breakdown (10% of the released part only; a full refund has no fee), the member read-only notice,
   the global header at 360px, and AA contrast in both themes. Write the review into `docs/decisions.md`, then queue
   the implementation.
6. Implement the design (the build steps are at the bottom of the brief).

Run one item per session. The foundation upgrade above is its own item; do it before or after the design, not inside it.

**Upstream candidate:** the `requireOrg` 404 patch in `FOUNDATION_PATCHES.md` fixes a template bug. Raise it with the
foundation when that repo is next open.
