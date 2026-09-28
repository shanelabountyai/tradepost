# Feedback run 2 (D-013), 2026-09-28

This run repeated the D-008 set. The five agents ran in sequence against the production build on :4200, using
`tradepost_test` reseeded by `seed:demo:test` between agents:
- Personas (Sonnet ×3): client, provider and admin.
- Red team (Opus ×1).
- Gap analysis (Sonnet ×1).

Each agent re-checked the D-008 findings (`docs/FEEDBACK.md`) and reported new ones. This pass only reports and fixes
nothing. The raw output (scripts and screenshots) lived in the session scratchpad and is not kept.

## Headline

**All four hard rules held for the second time**, now against the D-009 fixes, the D-011 design pass and the D-012
foundation merge:

- **Tenancy.** The red team replayed server actions (by `Next-Action` id) across orgs and across roles, and every
  replay returned 404.
- **Money.**
  - Eight concurrent confirms raced two disputes, and exactly one move landed.
  - Six concurrent admin resolutions produced exactly one settlement, and it was audit-logged.
  - Out-of-range, negative, fractional and non-numeric refunds were all refused, including with the client-side checks
    stripped.
  - The final SQL sweep covered 48 jobs, and every ledger equalled its hold.
- **Blind reviews.** Planted markers never appeared in the other party's HTML or RSC payload, for any role. The
  rating aggregate moved once, and only after both reviews were in.
- **Clock.** The only wall-clock reads are `core/clock.ts` and `core/log.ts`, and `/api/cron` fails closed.

**D-008 defects:** seven are fixed (F-01, F-02, F-04, F-05, F-06, F-12, F-13), F-19 is unchanged by design, and three
are still open (F-03, F-18, F-24). **What is new:** a race in the D-012 delete guard, and one launch gap the PRD never
addressed (F-26).

## D-008 findings re-checked

| # | Status now | Evidence |
|---|---|---|
| F-01 member has owner authority | **fixed** | The member's jobs and listings pages have no manage controls. Replayed manage actions return 404. |
| F-02 duplicate bookings | **fixed** | Search shows "Already requested" and links to the booking. A partial unique index backs it. |
| F-03 client sign-in lands on onboarding | **open, mitigated** | The magic link still lands on `/onboarding`. The D-011 header nav is the way out (`header.tsx:8` says so). |
| F-04 gated settings pages return 500 | **fixed** | A member gets 404 on `/settings/billing` and on `/settings/danger`. |
| F-05 resolved dispute unauditable | **fixed** | `/admin/disputes/<id>/thread` shows the statements, the thread and the split. Each read writes a `thread.adminRead` audit row. |
| F-06 fee not shown to client | **fixed** | The fee split is shown at booking and on every job card. |
| F-07 no notifications | **open** (gap) | Nothing in `src` writes a job event to the outbox. Pages still poll. |
| F-08 no quotes | open (gap) | Every booking is still at the flat `rateCents`. |
| F-09, F-10, F-22 | open (P1 cut / non-goal) | Unchanged. |
| F-11 no geocoder, F-23 thread limits | open (known ceilings, D-003 and D-006) | Unchanged. |
| F-12 homepage says "SaaS Foundation" | **fixed** | The title is "Tradepost", and the h1 is the product line. |
| F-13 identical dispute cards | **fixed** | Each card shows the short job id, the amount and the split. |
| F-14 no earnings view | open (P1 cut) | `/o/[org]` is still the template placeholder. |
| F-15 no evidence upload | open. **The PRD required it** | PRD P0-6 says "evidence (file upload)", and D-005 cut it to text-only statements. It was cut in a decision, not left out of scope by the PRD. |
| F-16, F-17, F-20 | open (P1 cut) | Unchanged. F-16's provider reply and report queue were never in the PRD. |
| F-18 raw Zod message in search | **open** | `lat=999` still renders "Too big: expected number to be <=90" (`search/page.tsx:104`). |
| F-19 composer live on closed jobs | unchanged, by design | A "closed" label was added. D-006 allows messages in every status, and D-011 kept that. |
| F-21 no mobile flows | downgraded | D-011 added a responsive layout and a mobile nav. |
| F-24 client MFA never required | open (observation) | The seed has the client at `mfa: false`, and the real sign-in never asks for MFA. |

## New findings, ranked

As in D-008, a defect in shipped scope ranks above a launch gap, whatever the gap's severity. F-25 breaks a guarantee
the product already claims.

| # | Sev | Type | Title | Source |
|---|---|---|---|---|
| F-25 | medium | defect | The D-012 "no deleting a provider with jobs" guard can be raced | red team |
| F-26 | high | gap | `requested` jobs never expire, and nobody is reminded | gap analysis |
| F-27 | high | gap | Provider onboarding leads to an empty page | gap analysis |
| F-28 | medium | gap | No unread indicator on message threads | provider |
| F-29 | medium | gap | No trust signals on search results | gap analysis |
| F-30 | low | defect | Role and admin checks run after input parsing | red team |
| F-31 | low | defect | A booking that loses the race to an org delete returns 500 | red team |
| F-32 | low | defect | The tenancy lint misses several bypass shapes | red team |
| F-33 | low | defect | DEMO.md stop 4 names a "Report a problem" button that no longer exists | client |
| F-34 | low | defect | The listing "Edit" control renders as a bare bullet | provider |
| F-35 | info | env | The demo seed does not clear orgs that integration tests leave in `tradepost_test` | client |

**F-25: the D-012 delete guard can be raced.** `beforeOrgDelete` (`src/app/org-hooks.ts`) counts the provider's jobs
with no lock. The core `deleteOrg` then deletes in a separate transaction, and `Job.org` cascades.
- **Reproduced:** `destroyOrg` fired alongside six `requestJob` calls. All six requests reported success and wrote
  `job.request` audit rows. The cascade then deleted the jobs, so those audit rows point at nothing.
- **Worse case, from reading the code (not reproduced):** a message lands in the same window, and the delete fails
  on the `Restrict` foreign key *after* the subscription was cancelled. That is the unbilled-org outcome D-012 exists
  to prevent.
- **Fix:** count and delete under one org lock (`lockOrg` already exists). The delete lives in `src/core`, which is
  template-owned, so this is either a clone-side lock taken in the hook or an upstream change that runs the hook
  inside the delete transaction.

**F-26: a request can sit unanswered forever.** `TRANSITIONS` (`src/lib/jobs.ts`) has no timeout out of `requested`.
With F-07, neither side is ever prompted. The PRD's P0-3 never specified one.

**F-27: provider onboarding leads to an empty page.** `/o/[org]` is still "Nothing here yet", and onboarding is the
template's generic "create an org" form. D-011's header now links every org, so more providers land on that page.

**F-30: role checks run after input parsing.** For example, a member calling `acceptJob` with a bad id gets "Invalid
UUID", and gets 404 only when the input is valid. The same happens with `manageAction` (`src/lib/roles.ts`) and
`resolveDispute` (`requirePlatformAdmin` sits inside the body). It leaks which actions exist, and the role check is
not guard-first.

**F-32: the tenancy lint misses several bypass shapes.** `tests/unit/tenancy-lint.test.ts` misses a query split over
lines (`db\n.job`), an alias (`const c = db`), bracket access (`db["job"]`), nested `include`/`select` from an
unscanned model, concatenated `$queryRawUnsafe`, and `providerRating`, which is not in `MODELS`. There is no current
violation.

## Most important for a launch

**F-07, notifications,** now compounded by F-26. Every fix since D-008 improved what happens inside a session, but
nothing reaches either party outside one. The outbox exists and is wired for billing. It has no job-event callers.
