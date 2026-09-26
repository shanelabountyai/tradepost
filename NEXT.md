# NEXT

**P0-3/P0-4 job lifecycle and escrow ledger done 2026-09-25** (D-004). It adds the `TRANSITIONS` table and `transition()` in
`src/lib/jobs.ts`, and an append-only `LedgerEntry` (hold, release, fee, refund) that `Restrict`s its job. A 10% fee
comes out at release. `autoConfirmDue()` runs in `/api/cron` on the injected clock. The pages are provider
`/o/[org]/jobs` and client `/jobs`, and `/search` has a Request button. The escrow invariant is asserted over every job
after every test in `tests/integration/jobs.test.ts`. The gate is green: lint, typecheck, drift, 150/150 tests and the build.

## Next item: P0-5 blind reviews + P0-6 disputes (Opus: permissions, money, and the blind-read rule)

1. Reviews: only on `closed` jobs, one per party, within 14d of `closedAt` (`@/core/clock`). Publish when both exist
   or when the window ends (cron). On publication, write `ProviderRating` (count, sum). An API-level test proves
   neither party can read the other's review before publication.
2. Disputes: open from `in_progress` or `completed` → a new `disputed` status + ledger state frozen. Add transitions to
   `TRANSITIONS`. `dueForAutoConfirm` already skips it, because it matches only `completed`. The admin resolution
   (refund, release or split) writes the ledger rows *and* the audit row in one transaction (D-004 ceiling). Statements
   are visible to the admin only. There is no platform-admin role yet, so decide how it is gated first.
3. Watch: after `prisma migrate dev`, revert the `migration_lock.toml` header (D-002). If a test DB migration
   fails on leftover rows, truncate the test DB, `migrate resolve --rolled-back`, and redeploy. It is disposable.

## Queue (PRD phasing)

1. ~~Tenancy + listings/search~~
2. ~~Job lifecycle + escrow ledger~~
3. Blind reviews + disputes
4. Threads; P1 only if time allows. Capstone demo: one job run twice, happy path then dispute, with the ledger balanced both times.
