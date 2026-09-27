# NEXT

Queue, in order:
1. Feedback run (D-008): **done**. Findings are in `docs/FEEDBACK.md`.
2. Fix item (D-009): **done**. F-01, F-02, F-04 and F-05 are fixed; how each was fixed is in `docs/decisions.md` → D-009.
3. **Next: the Claude Design pass on `docs/DESIGN_BRIEF.md`.**
4. Implement the design.

Run one item per session.

**Item: the Claude Design pass.** Sonnet fits for folding findings into the brief. Switch to Opus for the design review
itself.

**First, fold these into `docs/DESIGN_BRIEF.md`:**

- F-03: the client's sign-in lands on "Your orgs", and there is no nav.
- F-06: show the fee.
- F-12: the template branding on `/`.
- F-13: dispute cards need a short job id and the amount.
- F-19: the thread label on dead jobs.

Add two items that came out of D-009:

- An "already requested" state on `/search`. The database now refuses the duplicate, but search does not show that
  state yet.
- The member's read-only jobs and listings views: controls are hidden, and nothing on the page explains why.

**Upstream candidate:** the `requireOrg` 404 patch in `FOUNDATION_PATCHES.md` fixes a template bug. Raise it with the
foundation when that repo is next open.
