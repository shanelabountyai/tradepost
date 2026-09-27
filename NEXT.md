# NEXT

Queue, in order:
1. The feedback run (D-008) is **done**. Findings are in `docs/FEEDBACK.md`.
2. **Next: the fix item (D-009).** It covers F-01, F-02, F-04 and F-05.
3. The Claude Design pass on `docs/DESIGN_BRIEF.md`.
4. Implement the design.

Run one item per session.

**Item: fix the shipped-scope defects from FEEDBACK.md.** Use Opus: this item touches money authority and a foundation
patch.

- **F-01.** Gate provider job and listing actions by permission, for example `jobs.manage` and `listings.manage` for the
  owner and admin roles. Decide in D-009 whether `member` keeps messaging.
- **F-02.** Refuse a second active job for the same client, listing and date. Use a partial unique index plus a clear
  error. Add the missing test.
- **F-04.** Make an `AuthzError` during a page render return 404, not 500. `requireOrg` is template-owned, so go
  through `FOUNDATION_PATCHES.md`.
- **F-05.** Add an admin view of resolved disputes showing the statements, the thread and the resolution, with each read
  audit-logged.

Reset `tradepost_test` first, because it still holds the run's mutations (see FEEDBACK.md → Housekeeping).

**Before item 3:** fold F-03, F-06, F-12, F-13 and F-19 into the design brief.
