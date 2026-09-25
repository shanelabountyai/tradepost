# Tradepost — two-sided home-services marketplace

Spec: `prd-tradepost-marketplace.md`. Decisions: `docs/decisions.md`. Handoff: `NEXT.md` (read it first).
Base: first clone of **SaaS foundation v1.0.1** (`template` remote). Port **4200**.

## Hard rules (this project)

1. **Every provider-owned query goes through the tenancy layer.** A provider is an org; `providerId` = `orgId`.
   Provider-owned rows are read and written only through the scoped client. Another provider's row → 404, never 403.
   A lint/grep test fails the build if a raw query on a provider-owned model bypasses the layer.
2. **Money moves only via ledger writes.** For each job, the ledger rows always sum to the held amount. That
   invariant is tested, not assumed. Amounts are integer cents. Only client confirmation or auto-confirm releases
   funds, never the provider. Frozen funds move only by an admin resolution, and that resolution is audit-logged.
3. **Reviews are blind.** Neither party can read the other's review before publication, and that is asserted at the API level.
4. **Time comes from the injected clock** (`@/core/clock`), including auto-confirm (72h) and the review window (14d).
5. **Cut P1 ruthlessly.** Ship the two state machines (job lifecycle and escrow) first.

## Template rules (inherited)

- Never edit template-owned paths (`src/core`, `src/modules`, `tests/invariants`, security routes). `npm run foundation:drift` checks this.
  Urgent patches go in `FOUNDATION_PATCHES.md`.
- The clone's tables go in their own `prisma/schema/tradepost.prisma` with their own migrations. Harness rows go in `tests/fixtures/app.ts`.
- Guard first (`requireOrg` / `requireUser`). Every `'use server'` export is a public endpoint.

## Commands

`npm test` (local Postgres `tradepost_test`) · `npm run test:e2e` (prod build) · `npm run lint` · `npm run typecheck` · `npm run dev` → :4200
