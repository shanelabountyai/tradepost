# NEXT

> **Foundation upgrade waiting (2026-09-27): `v1.0.2`** — FR-01 outbox fix (send no longer inside the claim tx; a slow provider
> was delivered but never recorded, then re-sent every cron run). `git fetch template --tags && git merge v1.0.2`, no migration;
> re-run your outbox tests (a clone that wraps `drainOutbox` or its transports may conflict).
> **Then `v1.0.3` (security, take within 7 days)** — FR-02..05: pending-MFA 10-min TTL + daily wrong-code cap, invite send caps,
> org bound to one Stripe subscription (checkout refused while live), org deletion cancels the subscription first.
> `git merge v1.0.3`, then **`npm run db:migrate`** (adds `BillingAccount.stripeSubscriptionId`; deployed clones: migrate prod too).
> New clone-owned `src/app/org-hooks.ts`; a custom `PaymentProvider` needs `cancel()`. v1.1.0 (FR-06..11) follows.

Queue, in order:
1. Feedback run (D-008): **done**. Findings are in `docs/FEEDBACK.md`.
2. Fix item (D-009): **done**.
3. Design brief: **done**. F-03, F-06, F-12, F-13, F-19 and the two D-009 states are folded into `docs/DESIGN_BRIEF.md`.
4. Design pass (D-010, D-011): **done**. Implemented from Claude Design; the review and the three places the ledger overrode
   the mockup are in D-011.
5. Fix `e2e/demo.spec.ts`: **done** (D-011). Full e2e 10/10.
6. **Next:** foundation upgrade `v1.0.2` then `v1.0.3` (above).

Run one item per session. The foundation upgrade above is its own item; do it before or after the design, not inside it.

**Upstream candidate:** the `requireOrg` 404 patch in `FOUNDATION_PATCHES.md` fixes a template bug. Raise it with the
foundation when that repo is next open.
