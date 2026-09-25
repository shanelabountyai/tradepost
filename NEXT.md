# NEXT

**P0-2 listings & search done 2026-09-25** (D-003): the Listing fields and `ProviderRating`, provider CRUD at `/o/[org]/listings`,
public `/search`, pure `rankListings` with a unit test, and a `searchableListings` read path. The harness fixture ids are fixed.
Lint, typecheck, drift and build are clean.

## Next item: P0-3 job lifecycle + escrow ledger (Opus: money and a state machine)

1. Job states per PRD (request → accept → in progress → complete → confirm / auto-confirm → released), transitions as a pure table.
2. Ledger rows in integer cents. The rows for each job sum to the held amount (tested invariant). Only client confirm or the 72h auto-confirm
   (cron, `@/core/clock`) releases funds. Mock payment provider from the foundation.
3. Booking entry point: a "Request" button on `/search` results → `clientDb(session).job.create`.
4. Watch: after `prisma migrate dev`, revert the header it adds to `migration_lock.toml` (D-002). `migrate reset` needs
   explicit consent, so add hand-written SQL as a new migration rather than editing an applied one.

## Queue (PRD phasing)

1. ~~Tenancy + listings/search~~
2. Job lifecycle + escrow ledger (balance invariant; 72h auto-confirm on the clock)
3. Blind reviews (write `ProviderRating` on publication) + disputes
4. Threads; P1 only if time allows. Capstone demo: one job run twice, happy path then dispute, with the ledger balanced both times.
