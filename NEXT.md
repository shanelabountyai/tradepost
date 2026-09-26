# NEXT

**P0-7 threads done 2026-09-26** (D-006). Append-only `Message`, written through the party's scoped job. An admin
reads a thread only while the job is disputed (`/admin/disputes/[jobId]/thread`), and each read writes an audit row in
the same transaction. Both job pages poll every 10s. The gate is green: lint, typecheck, drift, 166/166 tests and the build.

## Next item: capstone demo seed (Sonnet for the seed script; Opus for the seeded-month invariant test)

1. Demo seed (`scripts/seed-demo.ts`, clone-editable): a provider, a client, a platform admin (TOTP-enrolled), and one
   job run twice: happy path, then dispute → split. Add a short thread on each job. PRD success metric: a seeded month
   (30 providers, 120 clients, 200 jobs, 15 disputes) ends every job in a terminal state with a balanced ledger. That is a test to write.
2. Watch: after `prisma migrate dev`, revert the `migration_lock.toml` header (D-002).
3. Then project closure: `docs/DEMO.md`, the exec brief, and the LinkedIn posts (global definition of done).

## Queue (PRD phasing)

1. ~~Tenancy + listings/search~~
2. ~~Job lifecycle + escrow ledger~~
3. ~~Blind reviews + disputes~~
4. ~~Threads~~; P1 only if time allows. Capstone demo: one job run twice, happy path then dispute, with the ledger balanced both times.
