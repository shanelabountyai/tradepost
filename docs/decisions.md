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
