# NEXT

**P0-1 tenancy layer done 2026-09-25** (D-002): `src/lib/tenancy.ts` (`providerDb` / `clientDb`), `Listing` and `Job`,
a lint test, and the fixture seeds. 130/130 tests pass, and lint, typecheck and drift are clean.

## Next item: P0-2 listings & search (Opus for the ranking; Sonnet is fine for the listing CRUD UI)

1. `Listing` fields: category, description, service area (center lat/lng + radius), base rate in integer cents, and a
   weekly availability pattern.
2. Provider listing CRUD through `providerDb` with `orgAction` (ids are `ref('listing')`, so INV-02 covers them).
3. Client search: filter by category + haversine in radius + available on date + min rating; rank by (rating, review
   count, distance). The ranking is a **pure function, unit-tested against fixtures**. Public listing reads need a
   read-only path in `src/lib/tenancy.ts`. The lint test forbids `db.listing` anywhere else.
4. Watch: after `prisma migrate dev`, revert the header it adds to `migration_lock.toml` (D-002 upstream note).

## Queue (PRD phasing)

1. ~~Tenancy~~ + listings/search
2. Job lifecycle + escrow ledger (balance invariant; 72h auto-confirm on the clock)
3. Blind reviews + disputes
4. Threads; P1 only if time allows. Capstone demo: one job run twice, happy path then dispute, with the ledger balanced both times.
