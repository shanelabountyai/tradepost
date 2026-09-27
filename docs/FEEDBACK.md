# Feedback run (D-008), 2026-09-26

Five agents ran in sequence against the production build on :4200, using `tradepost_test` seeded by `seed:demo:test`:
- Personas (Sonnet ×3): client, provider and admin.
- Red team (Opus ×1).
- Gap analysis (Sonnet ×1).

This pass only reports. It fixes nothing: each fix is its own item. The raw agent output (scripts, screenshots and full
findings) lived in the session scratchpad and is not kept in the repo.

## Headline

**All four hard rules held under attack.** The red team's evidence for each:

- **Tenancy.** Every cross-provider URL returns 404 rather than 403. Replaying a captured server action from the wrong
  tenant also returns 404.
- **Money.**
  - A provider has no path to release funds.
  - A non-admin replaying `resolveDispute` gets 404.
  - A refund above the held amount, a negative amount and non-integer cents are all refused.
  - When two concurrent confirms race, exactly one release lands.
  - A final SQL sweep found every job's ledger equal to its hold.
- **Blind reviews.** A marker string in an unpublished review never appeared in the other party's HTML or RSC payload,
  and the rating aggregate did not move.
- **Clock.** `advanceClock` has no runtime callers, and `/api/cron` fails closed with 401 while `CRON_SECRET` is unset.

Every `'use server'` export is guard-first. The admin persona separately confirmed that double-submit, concurrent
resolves and a refund with the client-side pattern stripped are all rejected on the server.

**This closes the one closure gap.** DEMO.md stops 2–5 have now been driven in a browser, including the real
magic-link sign-in, not only `/demo/signin`.

What broke is **authorization granularity inside a tenant, and the product around the state machines**, not the state
machines themselves.

## Findings, ranked

Type: **defect** is a bug or UX flaw in shipped scope. **gap** is a feature a real launch would need. **P1 cut** means
the PRD's nice-to-have list or DEMO.md dropped it on purpose.

| # | Sev | Type | Finding | Source |
|---|---|---|---|---|
| F-01 | high | defect, **fixed D-009** | A `member` has owner-level authority over money and inventory | provider, red team |
| F-02 | high | defect, **fixed D-009** | A client can book the same pro for the same date any number of times | client |
| F-03 | high | defect | A real client sign-in lands on the template's "Your orgs" page, and there is no nav | client |
| F-04 | high | defect, **fixed D-009** | Settings pages that need a permission return 500 instead of 404 | provider |
| F-05 | high | defect, **fixed D-009** | A resolved dispute can no longer be reviewed in the product | admin |
| F-06 | high | defect | The 10% platform fee is never shown to the client | client |
| F-07 | critical | gap | No notifications on job, dispute or message events | gap analysis |
| F-08 | high | gap | No quote or estimate flow; bookings are fixed-rate only | gap analysis |
| F-09 | high | gap, P1 cut | No identity, licensing, insurance or background checks | gap analysis |
| F-10 | high | gap, P1 cut | No real payment collection or payouts; the escrow is ledger-only | gap analysis |
| F-11 | high | gap, P1 cut | No geocoder; search takes raw lat/lng | gap analysis |
| F-12 | medium | defect | The homepage `<h1>` and `<title>` still read "SaaS Foundation" | client |
| F-13 | medium | defect | Admin dispute cards for the same client, pro and date look identical | admin |
| F-14 | medium | gap, P1 cut | No provider earnings or payouts view | provider, gap analysis |
| F-15 | medium | gap, P1 cut | No evidence upload on disputes | gap analysis |
| F-16 | medium | gap, P1 cut | No review moderation, provider reply or report queue | gap analysis |
| F-17 | medium | gap, P1 cut | No cancellation-fee policy | gap analysis |
| F-18 | low | defect | Search shows raw Zod messages for out-of-range URL params | client |
| F-19 | low | defect | The message composer stays live on declined and cancelled jobs, with no closed signal | provider |
| F-20 | low | gap, P1 cut | No saved searches or new-match alerts | gap analysis |
| F-21 | low | gap, P1 cut | No mobile-specific flows | gap analysis |
| F-22 | low | gap, P1 cut | Six flat categories, with no sub-services | gap analysis |
| F-23 | low | gap, P1 cut | No per-thread send rate limit, and no attachments | gap analysis |
| F-24 | info | observation | MFA is never required for the client role, although the client is the paying party | client |

F-07 is rated critical for a *launch*. It is ranked below the shipped-scope defects because none of those defects
needs new product scope to fix.

### Defects in shipped scope

**F-01 — `member` can do everything the owner can with jobs and listings.** Every provider job and listing action is
`orgAction(null, …)`, so the only check is membership:

- `src/app/o/[org]/jobs/actions.ts:12-56` covers accept (which commits the client's money to escrow), cancel (a full
  refund), dispute, the statement, review and message.
- `src/app/o/[org]/listings/actions.ts:37-49` covers add, update and delete listing.

`permissions.ts` grants `member` only `share.create`. Cross-tenant access still returns 404, so no hard rule is broken.
Two ways to fix it:

- Add `jobs.manage` and `listings.manage` permissions, granted to owner and admin.
- Or record in the decisions log that every member is trusted.

**F-02 — Duplicate bookings.**
- **Cause:** `requestJob` (`src/app/jobs/actions.ts`) has no check for an active job with the same client, listing and
  date, and `/search` never shows "already requested".
- **Repro:** request again from `/search`, or from a stale second tab. Either way the client ended up with three
  `requested` $185 jobs for one visit.
- **Test gap:** `tests/integration/jobs.test.ts` has no test for this case.
- **Fix:** a partial unique index on the active statuses, plus a "you already requested this" state on search.

**F-03 — A real client sign-in has nowhere to go.** The magic-link and TOTP sign-in redirects to `/onboarding`. That is
the template's "Your orgs" page, with a Create org form. Its only link, Account, links back to it, so it is a loop.
`src/app/layout.tsx` has no nav. A client has to type `/search` or `/jobs` by hand. `/demo/signin` hides this problem.
Fix: send a user with no org to `/jobs` (or `/search`), and add a signed-in header. The Claude Design pass (NEXT item 2)
should absorb the nav.

**F-04 — Permission-gated pages crash.**
- **Pages:** `/o/[org]/settings/billing` and `/settings/danger` call `requireOrg(slug, perm)` directly during render.
- **Cause:** `AuthzError` is caught only by the server-action `run()` wrapper, so a `member` loading the page gets
  HTTP 500 (React error #441).
- **Scope:** the nav hides the links, but the routes are unguarded against the throw.
- **Fix:** map `AuthzError` to `notFound()` in the page path. `requireOrg` lives in `src/core/authz/guards.ts`, which is
  template-owned, so the fix goes in `FOUNDATION_PATCHES.md` or goes upstream to the foundation. Find out which pages
  are template-owned before editing them.

**F-05 — A dispute is not auditable after it is resolved.**
- **Cause:** `openDisputes()` (`src/lib/tenancy.ts:101-110`) and `adminReadThread()` (`src/lib/threads.ts:24`) both
  require `status='disputed'`.
- **Effect:** the moment a dispute is resolved, it drops off the queue and its thread returns 404.
- **What survives:** only `AuditEvent {refundCents}`. It has no statements and no thread, and nothing in the UI shows it.
- **Fix:** add a "Resolved" admin view showing the statements, the thread and the resolution. Admin reads stay
  audit-logged.

**F-06 — The fee is hidden from the client.**
- **Ledger:** `fee` rows are written and balance correctly.
- **UI:** `src/app/jobs/page.tsx` renders only `refund` and `release` rows, and no page mentions a fee. The client sees
  "$185.00 held" and later "$166.50 paid to the pro". Nothing labels the $18.50 difference.
- **Fix:** show the fee at booking and on the closed job, for example "$185.00 = $166.50 to the pro + $18.50 service
  fee".

**F-12.** `src/app/page.tsx` still carries the template branding.

**F-13.** Admin dispute cards show only the listing, org, client email and date (`src/app/admin/disputes/page.tsx:21-26`).
Add a short job id and the amount.

**F-18.** `src/app/search/page.tsx` renders `q.error.issues[0]?.message` verbatim.

**F-19.** `ThreadPanel` (`src/app/jobs/panels.tsx`) has no status gating. Either disable sending on dead jobs or label
the job as closed. Messages are allowed in every status by D-006, so this is about the label.

### Launch gaps

**F-07 — Notifications.** No event notifies anyone: request, accept, decline, complete, dispute opened or resolved, or
new message. D-006 made updates a 10s refresh that works only while the tab is open. The foundation's outbox
(`src/modules/notifications`) is present but has no callers. Nothing in the PRD cut this; the PRD lists only new-match
notifications. This is the cheapest high-value gap, because it only wires up transports that already exist.

**F-08 — Quotes.** Every booking snapshots the listing's flat `rateCents` (D-004). Request-for-quote is the category's
core model, and the PRD's non-goals do not mention it. Either decide to cut it in the decisions log or plan it.

**F-09–F-11, F-14–F-17, F-20–F-23** are deliberate P1 cuts (PRD nice-to-have, DEMO.md "concede" list). They are listed
so the set is complete. Nothing new is needed until the project is reopened.

## Housekeeping from the run

The run left mutations in `tradepost_test`:

- the client's three duplicate `requested` jobs;
- two jobs driven through dispute and resolve;
- a marker review;
- the admin's resolved disputes.

`seed:demo` does not clean these up, because a re-run finds the client's jobs and adds none. Reset the database before
the next demo or sweep.
