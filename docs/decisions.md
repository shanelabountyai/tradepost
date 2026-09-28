# Decisions

## D-001 — Built on SaaS foundation; provider = org (2026-09-25)

**Chose:** clone `saas-foundation` v1.0.1 as its first clone. Each provider business is an org, so the PRD's `provider_id` is the `orgId`.
Clients are plain users with no org. A dual-role user is a client and also a member of their own provider org.

**Why:** auth (magic link + TOTP), the append-only audit log, cron, the injected clock and the mock payment provider are
already built and invariant-tested. Mapping provider to org reuses the foundation's not-found-on-foreign-row guard (`requireOrg`)
and the INV-01..04 harness, so neither is re-derived.

**Rejected:** a standalone app (it rebuilds solved auth and audit), and clone with a separate `Provider` table
(it carries unused org machinery alongside a second tenant key).

**Consequence:** the PRD asks for a scoping layer that *injects* the tenant filter. The template's convention is to
*spread* `inOrg(ctx)` by hand, so this clone adds a scoped client for provider-owned models (P0-1) and a lint test
against raw access. Client-side reads (search, a client's own bookings) are scoped by `clientId`. They are a
second axis, and they must not share the provider path (the PRD's dual-role bleed test).

## D-002 — P0-1 tenancy layer build choices (2026-09-25)

**Chose:** `src/lib/tenancy.ts` exposes `providerDb(ctx)` (listing, job; `orgId`) and `clientDb(session)` (job; `clientId`),
each a Prisma query extension that ANDs the tenant key into every `where`, stamps it on every `create`, and throws on an
update that names a tenant key (`orgId`/`org`/`clientId`/`client`), so rows never move between tenants. A foreign id
reads as `null` or P2025, and callers map that to `notFound` with the template's `notFoundOnP2025`.
`Job → Listing` is a composite FK on `(listingId, orgId)`, so the database refuses a job whose listing belongs to another
provider. `Job.clientId` is `onDelete: Restrict`: money rows never disappear with an account.
`tests/unit/tenancy-lint.test.ts` scans `src/` for `db|tx|prisma.<model>` and quoted raw table names outside the layer.
It carries its own negative control. Tests and seed scripts are exempt on purpose.

**Why:** the PRD asks for injection rather than a spread by hand, and an extension gives that in about 30 lines, with no
wrapper function per query. A mutation check (filter disabled) turns 4 of the 6 integration tests red. The other two
guard the immutability check and the FK, which do not depend on the filter.

**Known ceiling:** only top-level queries are rescoped. A nested `include` or a nested write through another model is
not. That is marked `ponytail:` in the layer.

**Upstream note:** `prisma migrate dev` re-adds Prisma's two-line header to `migration_lock.toml`, and that trips
`foundation:drift`. It was reverted here. The template should ship the header.

## D-003 — P0-2 listings & search build choices (2026-09-25)

**Chose:**
- **Listing fields.** `category` is a Prisma enum (one level, PRD non-goal). The service area is `lat`/`lng` + `radiusMiles`.
  `rateCents` is an integer, and the form takes whole dollars. `days Int[]` holds the weekly pattern (0 = Sunday). A
  separate migration adds database CHECKs for the rate, radius, coordinates, days and the rating range.
- **Rating lives in `ProviderRating`** (orgId PK, `count`, `sum` of stars), not in columns on the template's `Org`. The
  mean is computed as `sum / count`, so no stored float can drift. P0-3 writes it on publication.
- **Search splits in two.** `searchableListings` in `src/lib/tenancy.ts` is the one un-tenanted, read-only, field-selected
  read, and it narrows by category and weekday in SQL. `rankListings` in `src/lib/search.ts` is pure: it filters on
  haversine distance ≤ the listing's own radius and on min rating, then orders by mean desc, count desc, distance asc.
  Unrated scores 0. A calendar date's weekday is read in UTC.
- **`Job → Listing` is now `NoAction`.** A listing with jobs refuses deletion (`Refused`), so money rows never cascade
  away. An org delete still cascades both, because NO ACTION is checked at the end of the statement.
- **`/search` is a public GET form**, so a search is a URL. Weekdays post as checkboxes `d0`–`d6`, because the action
  layer's `Object.fromEntries(FormData)` keeps only the last value of a repeated name.

**Found:** `seedApp` (P0-1) returned random ids, but the harness reseeds before every call and generates each input
only once. Every `ref('listing')` action would therefore have hit a stale id. The fixture ids are now fixed.

**Known ceilings:** the client types coordinates, because there is no geocoder. The distance filter runs in memory after the SQL narrowing, and
a bounding-box `WHERE` is the upgrade if the listing count grows. Availability is by weekday only, because hours arrive with booking.

## D-004 — P0-3/P0-4 job lifecycle and escrow ledger (2026-09-25)

**Chose:**
- **One transition table** (`TRANSITIONS` in `src/lib/jobs.ts`). Each move has a fixed actor set, one `from`, one `to`
  and one money effect. `transition()` is the only way a job moves. It reads through the caller's scoped client, so a
  foreign id is `notFound`, and it writes with `where: { id, status: from }`, so a stale read (a double-click, or the
  cron racing a confirm) matches nothing and is refused. The ledger rows go into the same nested update as the status change.
- **States:** `requested → accepted | declined`, `requested → cancelled` (the client withdraws, nothing held),
  `accepted → cancelled` (either side, full refund), `accepted → in_progress → completed → closed`. The PRD's
  `confirmed_by_client | auto_confirmed → closed` collapse into `closed` plus `closedAt`. The audit event
  (`job.confirm` with a user, `job.autoConfirm` with no actor) records which one it was. An in-progress job cannot be
  cancelled; that is a dispute (P0-6).
- **Ledger:** `LedgerEntry(kind: hold | release | fee | refund, amountCents > 0)`. Rows are append-only (a trigger)
  and `Restrict` on the job. The fee is 10%, rounded down, and the provider gets the rest, so release + fee = hold exactly.
  The invariant (hold = `amountCents` once accepted, payouts are 0 until settled and then equal the hold) is
  asserted over every job after every test in `tests/integration/jobs.test.ts`.
- **Release is by the client or `system` only.** The table says so, a test pins it, and no provider action exists for it.
- **Auto-confirm:** `autoConfirmDue()` runs in `/api/cron`. It reads due jobs through `dueForAutoConfirm` (a read-only
  system door in the tenancy layer), then moves each one through `providerDb` for its own org.
- **Booking:** `requestJob` snapshots the listing rate into `Job.amountCents` and refuses a past date, a day off and
  self-booking by a member of the provider org. Self-booking would let a provider review itself (P0-5).
  Its `listingId` is a regex-checked string, not `ref('listing')`. A listing id is public, and booking another org's
  listing is the point, so the harness's "another org's id is refused" (INV-02) would be a false alarm.

**Found:** the first race test fired three `confirm`s through `Promise.allSettled`, and it passed even with the status
guard deleted. The in-process calls serialize, so nothing raced. It was replaced by a stale-read replay, which fails
without the guard. Both mutations (the status guard removed, and the release rows removed) turn tests red.

**Known ceilings:** no real charge happens, because the foundation's `PaymentProvider` covers subscriptions only and
`src/modules` is template-owned. The hold is a ledger fact, and the PRD makes payments a non-goal. An org with money history
cannot be deleted (Restrict + append-only), so the template's delete-org page errors for it, and that is deliberate.
Audit rows are written after the move, not in the same transaction. P0-6's frozen-funds resolution must audit atomically.

## D-005 — P0-5/P0-6 blind reviews and disputes (2026-09-26)

**Asked and answered:**
- **The platform-admin gate is a `PlatformAdmin` table** (userId PK, no FK, so the template's `User` stays untouched).
  Granting is inserting a row. `requirePlatformAdmin` (`src/lib/admin.ts`) returns notFound for a non-admin, so the
  surface does not announce itself, and it requires MFA, as the org guard does for owners (INV-22). The rejected
  options were an env allowlist (per-environment drift) and a platform org (it conflates a provider org with the platform).
- **Evidence is text statements only.** Each party gets one statement, which it can replace while the dispute is open.
  File upload is deferred to P1, because the foundation has no storage and upload would roughly double P0-6.

**Chose:**
- **Reviews:** `Review(jobId, by: client|provider, stars 1..5 CHECK, body, publishedAt)`, unique per party per job. A
  review is allowed only on a `closed` job, before `closedAt + 14d` (the injected clock). Publication happens when both
  reviews exist (the submit path) or when the window ends (`publishDueReviews` in `/api/cron`). Publishing the client's
  review adds its stars to `ProviderRating` exactly once, guarded by `updateMany … publishedAt: null` in the same
  transaction. The provider's review of the client is published but never aggregated.
- **The blind read is structural.** `reviewsVisibleTo(party)` in the tenancy layer is the only include that reads
  reviews: it returns the party's own review, and the other's only once published. The tenancy lint now covers `review`
  and `dispute` as models, and it flags a `reviews:` / `dispute:` relation token anywhere outside `src/lib/`, so a page
  cannot `include: { reviews: true }` its way around the rule.
- **Disputes:** `dispute` (client or provider, from `in_progress | completed` → `disputed`, money null = frozen) and
  `resolve` (admin only, `disputed → closed`, money `split`) join `TRANSITIONS`. `from` may now be a list, and the status
  guard writes `where: { status: <the status read> }`. The only way out of `disputed` is `resolve`, and a test pins that.
  A split refunds `refundCents` and releases the remainder, and the 10% fee is taken only on the released part.
  `settleDispute` runs the transition and the `dispute.resolve` audit row in one transaction (`inProviderTx`), which
  closes D-004's ceiling for frozen funds. A resolved dispute closes the job, so the review window opens.
- **Statements live on `Dispute`**, not `Job`. A scoped job read returns only Job scalars, so a party can never pull
  the statements. The admin page (`/admin/disputes`) reads them through `openDisputes()`.
- **The admin action takes `jobId` as a regex string, not `ref('job')`,** following the precedent of `requestJob`. An admin
  works across providers, so INV-02 ("another org's id is refused") would be the opposite of the action's purpose.
  The guard is pinned in `jobs.test.ts`: notFound for a non-admin, MFA required, then it settles.

**Found:** the two blind-review guards were each deleted in turn, and both mutations turned tests red: dropping the
`publishedAt: null` guard double-counted a rating, and dropping the visibility filter leaked the review.

**Known ceilings:** there is no evidence upload yet. Dispute outcomes reach the parties through the ledger lines on their
job pages. There is no dedicated "outcome" text. The first-rating `upsert` for a provider can hit P2002 if two of its jobs
publish their first reviews at the same instant. That is rare, and a retry fixes it. Admins are granted by SQL, and the demo seed will add one.

## D-006 — P0-7 message threads (2026-09-26)

**Chose:**
- **`Message(jobId, by: client|provider, body, createdAt)`** is append-only (a DB trigger, like the ledger), because a
  thread can be dispute evidence. A CHECK keeps the body non-empty. Writes go through `postMessage` (`src/lib/threads.ts`)
  as a nested create on the party's own scoped job, so a foreign job is notFound. Parties read the thread as
  `include: { messages: THREAD }` on their scoped job. `message` joins the tenancy lint's models. It is not a flagged
  relation, because unlike reviews, both parties may read all of it.
- **Admin read:** `adminReadThread` runs in `inProviderTx`. The thread is found only while the job is `disputed`, and
  any other status, including after resolution, is notFound. The `thread.adminRead` audit row commits in the same
  transaction as the read. It has its own page (`/admin/disputes/[jobId]/thread`), so opening the disputes list does not
  log a read of every thread. Mutation-checked: dropping the `disputed` filter turns the test red.
- **Polling:** `Poll` calls `router.refresh()` every 10s while the tab is visible, on both job pages. No sockets (a PRD non-goal).

**Known ceilings:** there is no per-user rate limit on sending, which the foundation's `rate-limit.ts` can add if spam
shows up. Messages are allowed in every job status. Each admin page render counts as one audited read, including a reload.

## D-007 — capstone demo seed and the seeded month (2026-09-26)

**Chose:**
- **`scripts/seed-demo.ts` replaces the template's acme/globex seed.** It seeds two providers: Brightline Plumbing (owner,
  admin and member) and Fernway Cleaning (owner). It also seeds a client and a platform admin (`ops@`). That is six demo
  users, four of them TOTP-enrolled, which is the count template-owned INV-27 asserts, so the invariant stands unedited.
- **The capstone runs through the real code paths**, not inserted rows: `transition`, `postMessage`, `submitReview`,
  `submitStatement` and `settleDispute`. Brightline's $185 job runs twice. The first is confirmed, with both reviews
  published. The second is disputed and split, with $74 refunded, $99.90 released and a $11.10 fee. Each has a thread.
  A re-run finds the client's jobs and adds none.
- **`seedMonth()`** (`npm run seed:demo -- --month`) drives the PRD's month through the injected clock. It has 30
  providers and 120 clients, 10 of whom also own a provider. There are 200 jobs over 30 days, the cron runs daily, and
  every path is covered: decline, withdraw, cancel, confirm, 72h auto-confirm, and 15 disputes. Those disputes are opened
  by both sides, with no refund, a partial refund and a full refund. It is deterministic: job *i*'s provider, client and
  path follow from *i*. `tests/integration/seed.test.ts` asserts every job is terminal with its ledger balanced, and that
  the platform's holds equal its payouts. It also checks that no client ever booked their own business.

**Found:** a negative control (skipping the month-end cron drain) left auto-confirm jobs `completed`, and the test went
red, naming the job.

**Known ceilings:** the month's users are not `isDemo`, so they cannot be signed into. They exist to fill search and to
prove the invariant.

## D-008 — post-closure feedback run (2026-09-26)

Shane chose the full run over personas-only, gap-only or red-team-only: breadth is worth the tokens once, after closure.
Five agents run **in sequence**, never overlapping, because only one server and one sweep may run at a time:

1. **Personas (Sonnet ×3).** A client, a provider and an admin each drive the seeded demo (`npm run seed:demo`) in a
   browser against the production build on :4200, following `docs/DEMO.md`. This also closes the one closure gap:
   stops 2–5 were never browser-driven.
2. **Red team (Opus ×1).** Tries to break the hard rules: another provider's row (must 404), a provider releasing funds,
   reading a review before publication, and unbalancing a job's ledger.
3. **Gap analysis (Sonnet ×1).** Compares the PRD and shipped code against Thumbtack/Angi-style norms and returns a ranked list
   of missing features, marking which ones are the P1 cuts made on purpose.

**Output:** `docs/FEEDBACK.md` with one findings list ranked by severity. Nothing is fixed in the same pass; fixes are
separate items.

**Outcome (2026-09-26):** 5/5 agents completed and returned 24 findings, ranked in `docs/FEEDBACK.md`. All four hard
rules held under the red team. Six shipped-scope defects were found:

- F-01: `member` has owner authority over jobs and listings.
- F-02: duplicate bookings.
- F-03: a real client sign-in lands on the template's org onboarding page, and there is no nav.
- F-04: permission-gated settings pages return 500.
- F-05: a resolved dispute is unauditable in the UI.
- F-06: the platform fee is not shown to the client.

F-07 (no event notifications) is the one launch gap the PRD never cut.

## D-009 — fix the shipped-scope defects before the design pass (2026-09-26)

**Chose:** F-01, F-02, F-04 and F-05 from `docs/FEEDBACK.md` become one fix item, queued ahead of the Claude Design pass.
Shane picked this over fixing after the design, folding the fixes into the design implementation, or not fixing. The
reasons:

- F-01 changes who can move money, and F-04 needs a foundation patch. Neither belongs in a UI diff.
- The design pass should start from an app whose behaviour is correct.

The design-shaped findings (F-03, F-06, F-12, F-13 and F-19) go into the design brief instead.

**How each was fixed (2026-09-26):**

- **F-01.** Provider job moves, disputes, statements, reviews of the client, and every listing action are owner/admin
  only, through `manageAction` in `src/lib/roles.ts`. A `member` keeps reading jobs and **keeps messaging**: the member is
  the one on site, and a message moves no money. The rule lives in the clone, not in the template's permission table,
  because jobs and listings are this app's concepts. A member's attempt reads as notFound, the same as F-04.
- **F-02.** A partial unique index on `Job (clientId, listingId, date)` over the live statuses (requested, accepted,
  in progress, completed, disputed). Declined, cancelled and closed jobs free the date. `requestJob` turns the
  violation into "You already requested this pro for that date." The "already requested" badge on `/search` goes to
  the design pass.
- **F-04.** `requireOrg(slug, perm)` calls `notFound()` for a missing permission instead of throwing `AuthzError`.
  It is one line in a template-owned file, so it is listed in `FOUNDATION_PATCHES.md` and marked for upstream: the bug is
  the template's. Server actions get a 404 instead of a 500 too.
- **F-05.** An admin can read a job's case file (thread, both statements, resolution) for any job with a dispute,
  open or resolved, and each read is audit-logged as before. `/admin/disputes` lists resolved disputes, without
  statements, and links to the case page. This relaxes P0-7's "only while disputed" to "only once disputed".

## D-010 — the design is made in Claude Design, not in this repo (2026-09-27)

**Chose:** Shane pastes `docs/DESIGN_BRIEF.md` into Claude Design and brings back the output, and a session here reviews
it against the brief before any CSS is written. Picked over building it here as a Design artifact (a weaker design, and
the mockups fill the session's context) and over going straight to `globals.css` (no chance to compare before code).
The brief now carries F-03, F-06, F-12, F-13, F-19 and the two D-009 states (commit `2d8e83a`).

## D-011 — design pass 1 implemented, with the ledger overriding the mockup where they disagree (2026-09-28)

**Source:** Claude Design project `a8da9f80-0ed5-4607-9951-d12916576274` (`Tradepost Design.dc.html`, `JobCard.dc.html`,
`SiteHeader.dc.html`). Tokens, type, the job card, the header, and every state in the brief went into one
`src/app/globals.css` plus light classes on the clone-owned pages. `foundation:drift` is clean.

**Where the design was wrong and the code won:**

- **"Money is held at request."** It is not: `accept` writes the hold and `decline`/`withdraw` write nothing
  (`TRANSITIONS` in `src/lib/jobs.ts`). A requested card shows nothing held ("Held when <pro> accepts … Nothing is
  charged if they decline"), a declined or withdrawn job reads "Nothing was charged", and only a cancelled-after-accept
  job reads "Refunded in full. No service fee." The search hint says the same.
- **Dispute panel on `accepted`.** The state machine allows a dispute from `in_progress` and `completed` only, so the
  panel stays on those two plus `disputed`.
- **Provider "Cancel and refund" on accepted** is kept as a secondary action. The mockup dropped it, but removing a
  shipped move is not a design decision.

**How the money is shown:** every figure is read from the job's ledger rows. The "once released" projection and the
admin split text call the same `ledgerRows()` the release writes, so the rounding cannot disagree
(`tests/unit/job-card.test.ts`).

**Deferred (ponytail):** the admin's live split preview (needs client-side money math, a second copy of the fee rule),
and `confirm()` on Withdraw, Cancel and Decline. Add them when a demo shows someone misclicking.

**Header and e2e:** the header lists each of the user's orgs by name, so `/onboarding` now has two "Acme …" links, and
org pages have two navs (Main and Business). `e2e/demo.spec.ts` and `e2e/onboarding.spec.ts` scope their locators to
`main` and the Business nav. `e2e/` is not template-owned.

**Found, not fixed:** `e2e/demo.spec.ts` cannot load. It imports `scripts/seed-demo.ts` → `src/lib/jobs.ts` →
`next/navigation`, which Node's ESM loader in Playwright cannot resolve without `.js`. This has been broken since D-007
and is not caused by this pass. The other five specs pass (9 tests).
**Fixed 2026-09-28:** the spec runs `npm run seed:demo:test` as a child process instead of importing the seed, and
now names the Brightline owner (it still named the template's Acme org). Full `npm run test:e2e`: 10/10 passed.

## D-012 — foundation v1.0.2 + v1.0.3 merged; provider deletion refused before the subscription is cancelled (2026-09-28)

**Merged:** `v1.0.2` (FR-01, outbox send outside the claim transaction) and `v1.0.3` (FR-02..05). Only `NEXT.md`
conflicted, and ours was kept. Migration `20260927000000_billing_subscription_id` is applied to local dev and test.
Nothing is deployed, so there is no production database to migrate. `src/app/cron-jobs.ts` calls `drainOutbox`
unwrapped, so FR-01 needed no clone change. There is no custom `PaymentProvider`.

**Found:** FR-05's new `beforeOrgDelete` cancels the Stripe subscription, and only then does the org row get deleted. A
provider with jobs cannot be deleted (D-004: the ledger is Restrict and append-only). So for that provider the delete
failed *after* the cancel: the org stayed, but it was no longer billed. The clone-owned `src/app/org-hooks.ts` now
refuses first, through `providerDb`, if the provider has any job. `tests/integration/org-delete.test.ts` asserts the
refusal, that `cancel` is never called, and that the org remains. It fails with the guard removed.

**Upstream bug:** neither tag bumped `FOUNDATION_VERSION`, so `foundation:drift` compared against v1.0.1 and reported
every upstream change as clone drift. The clone sets it to `v1.0.3`, and that is recorded in `FOUNDATION_PATCHES.md`.

**Gate:** lint, typecheck and drift are clean. `npm test` passes 186/186. `npm run test:e2e` passes 10/10.

## D-013 — second full feedback run, before closure (2026-09-28)

**Chose:** rerun the full D-008 set (Sonnet personas ×3, Opus red team, Sonnet gap analysis). Shane picked this over a
review of only the changes since D-008 (the recommended option), a red-team-only retest, and going straight to closure.
Since D-008, the D-009 fixes, the design pass (D-011) and the foundation v1.0.2/v1.0.3 merge (D-012) have changed 52 files.

The agents run in sequence on the production build on :4200, using `tradepost_test` seeded by `seed:demo:test`, as in
D-008. Each agent is also told the D-008 findings, so it can mark each one fixed, still open, or regressed, and report
anything new. **Output:** `docs/FEEDBACK-2.md`. Nothing is fixed in this pass.

**Outcome (2026-09-28):** 5/5 agents completed, and the findings are in `docs/FEEDBACK-2.md`. All four hard rules held
again. Of the D-008 defects, seven are fixed, F-19 is unchanged by design, and F-03, F-18 and F-24 are still open.
Eleven new findings (F-25..F-35). The one shipped-scope defect that matters is **F-25**: the D-012 delete guard can
be raced, because the job count and the delete are not under one lock. Two launch gaps were new: F-26 (requests never
expire) and F-27 (provider onboarding lands on an empty page). F-15 was re-classified: the PRD required evidence
upload, and D-005 cut it. The fix item is not yet chosen.

This run started after a CI fix. `modules-removed` had been red since D-012, because `tests/integration/org-delete.test.ts`
statically imported the removable billing module. The test now loads billing at runtime and still runs every time.
Shane picked this over an upstream manifest change or leaving CI red. A version with `it.skipIf` was refused by the
auto-mode classifier as test removal, and it was not needed, because `modules-removed` only typechecks.
