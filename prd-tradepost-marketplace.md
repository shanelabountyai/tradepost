# PRD: Tradepost — Two-Sided Services Marketplace

**Sample business:** "Tradepost," a local home-services marketplace (handymen, cleaners, tutors) connecting providers and clients
**Status:** Draft v1.0 — capstone project; PM + marketplace-operator review baked in
**Learning objectives:** multi-tenant data scoping, escrow-style payment state machine, blind mutual reviews, matching/search, dispute workflow

**Sequencing note:** Built LAST on purpose. Composes Bookable (provider availability), BoxLoop (payment states), Groundwork (proximity), Clearpath (role separation) — plus the two lessons only it teaches: tenancy and escrow.

---

## Problem Statement

A marketplace is two products wearing one interface: providers need listings, calendars, and earnings; clients need search, booking, and recourse when a job goes wrong. The platform sits between them holding money and trust. The builder-side lesson is architectural: N providers' data isolated inside one app (multi-tenancy), and funds held between two parties with opposing interests (escrow) — neither of which any single-business project can teach.

## Goals

1. Every provider sees only their own listings, jobs, and earnings — enforced by query-level tenancy scoping, not per-endpoint checks.
2. Money flows through an escrow state machine: held at booking, released on completion, frozen on dispute.
3. Reviews are mutual and blind: neither party sees the other's review until both submit or the window closes.
4. Clients can match to providers by service, area, availability, and rating.
5. **(Builder goal)** Multi-tenancy, escrow, reputation design, matching.

## Non-Goals

- Real payments/payouts (mock provider per house convention; escrow *states* are the lesson)
- Identity/background-check verification (a `verified` boolean with a stubbed process)
- Real-time chat (plain message threads, polling)
- Provider subscription tiers (BoxLoop covered it)
- Native mobile; multi-category taxonomy depth (one level of service categories)

## Personas

Client (books, pays, reviews, disputes) · Provider (lists, accepts, completes, reviews) · Platform admin (disputes, refunds, moderation) — one person can hold both client and provider roles (real marketplaces allow it; it stress-tests the tenancy model).

## Requirements — Must-Have (P0)

**P0-1: Tenancy scoping** *(core learning artifact #1)*
All provider-owned rows carry `provider_id`; every query passes through a scoping layer that injects the tenant filter.
- [ ] A provider requesting another provider's job by ID gets 404 (not 403 — don't leak existence)
- [ ] Grep/lint test: no raw table query bypasses the scoping layer
- [ ] A dual-role user's client data and provider data never bleed into each other's views

**P0-2: Listings & search/matching**
Provider listings: service category, description, service area (center + radius, haversine), base rate, availability (weekly pattern, reused from Bookable).
- [ ] Client search filters by category + location-in-radius + available-on-date + min rating; results ranked by (rating, review count, distance)
- [ ] Ranking function is pure and unit-tested against fixtures

**P0-3: Booking → job lifecycle**
`requested → accepted | declined → in_progress → completed_by_provider → confirmed_by_client | auto_confirmed (72h) → closed`; cancellation rules per state.
- [ ] Provider acceptance atomically holds the escrow amount (P0-4); decline releases nothing (nothing held)
- [ ] Auto-confirm job runs on the injected clock (batch-job convention)

**P0-4: Escrow state machine** *(core learning artifact #2)*
Funds ledger per job: `held → released_to_provider | refunded_to_client | frozen (dispute) → split_resolution`; platform fee (percentage, integer cents) deducted at release.
- [ ] Every money movement writes a ledger row; sum of ledger rows per job always equals the held amount (invariant test)
- [ ] Release is triggered only by client confirmation or auto-confirm — never by the provider
- [ ] Frozen funds cannot move except by an admin resolution action, which is audit-logged

**P0-5: Blind mutual reviews** *(core learning artifact #3)*
Both parties may review within 14 days of close; reviews publish when both exist or the window ends.
- [ ] Neither review is visible to the other party pre-publication (API-level test)
- [ ] Reviews only from closed jobs (no drive-by reviews); one per party per job
- [ ] Provider aggregate = mean rating + count, recomputed on publication; aggregates match hand-tallied fixtures

**P0-6: Dispute workflow**
Client or provider opens a dispute on a completed-but-unconfirmed or in-progress job → escrow freezes → both submit statements + evidence (file upload) → admin resolves (full refund / full release / split).
- [ ] Opening a dispute halts auto-confirm
- [ ] Resolution writes the split to the ledger atomically and closes the job
- [ ] Both parties see the outcome; statements are visible to admin only

**P0-7: Message threads**
Per-job thread between client and provider; polling; admin can read threads on disputed jobs only (audit-logged when they do).

## Nice-to-Have (P1)

Saved searches + new-match notifications (outbox stub) · provider earnings dashboard (released, held, fees) · admin moderation queue for reported reviews · cancellation-fee policy tied to lifecycle state.

## Success Metrics (seeded)

- Tenancy: 100% of cross-tenant access fixtures return 404; lint test passes
- Escrow invariant: ledger sums balance on 100% of a 200-job simulated marketplace including 15 disputes
- Blind reviews: 0 pre-publication leaks across the API test suite
- Simulation: a seeded month (30 providers, 120 clients, 200 jobs, disputes, dual-role users) closes every job in a terminal state with a balanced ledger

## Phasing

1. Tenancy layer + listings/search — 2. Job lifecycle + escrow — 3. Reviews + disputes — 4. Threads, P1; capstone demo = one job end-to-end twice: happy path, then dispute path, with the ledger shown balancing both.

## Build Notes for Claude Code

CLAUDE.md: all house conventions + **every provider-owned query goes through the tenancy layer** and **money moves only via ledger writes; the ledger-balance invariant is tested, not assumed**. TDD order: tenancy scoping → escrow ledger → ranking function. This project is the scope trap of the set — cut P1 ruthlessly, ship the two state machines.
