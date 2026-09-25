# NEXT

**Setup done 2026-09-25.** Cloned from the foundation (v1.0.1), renamed to `tradepost` on :4200, and the local DBs
`tradepost` and `tradepost_test` are migrated. The baseline passes 122/122 tests, and lint and typecheck are clean. Base decision: `docs/decisions.md` D-001.

## Next item: P0-1 tenancy layer (Opus)

TDD, in this order (PRD build notes):
1. `prisma/schema/tradepost.prisma`: `Listing` (orgId), `Job` (orgId + clientId). Minimal fields only; escrow comes later.
2. A scoped client for provider-owned models that injects `orgId` from `OrgCtx`. The client side is scoped by `clientId`,
   through a separate path.
3. Tests: a foreign provider's job by id → 404; a dual-role user's client view never shows their provider rows and
   vice versa; a lint/grep test that no raw `db.listing|db.job` access exists outside the layer.
4. `tests/fixtures/app.ts` `seedApp`: seed one listing and one job per fixture org, so INV-01..04 cover them.

## Queue (PRD phasing)

1. Tenancy + listings/search (haversine, a pure ranking function unit-tested against fixtures)
2. Job lifecycle + escrow ledger (balance invariant; 72h auto-confirm on the clock)
3. Blind reviews + disputes
4. Threads; P1 only if time allows. Capstone demo: one job run twice, happy path then dispute, with the ledger balanced both times.
