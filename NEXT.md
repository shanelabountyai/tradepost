# NEXT

**P0-5/P0-6 blind reviews and disputes done 2026-09-26** (D-005). There is a `Review` table, published when both
parties have reviewed or at 14d (cron). `reviewsVisibleTo()` is the only read, and the lint flags any other.
`disputed` status + admin `resolve` (a split, where the fee applies to the released part only). The ledger and the
audit row are written in one transaction. `PlatformAdmin` table + `requirePlatformAdmin` (notFound for a non-admin,
MFA required). `/admin/disputes` shows the statements, and nothing else does. Evidence upload is P1. The gate is
green: lint, typecheck, drift, 162/162 tests and the build.

## Next item: threads (P1-ish, P0 queue item 4), then the capstone demo seed (Sonnet for threads/seed; Opus for the simulation invariant)

1. Per-job thread between client and provider, polling. An admin can read a thread only on a disputed job, and each
   read is audit-logged. Reach it through the job's scoped client, the same way as reviews, and add `message` to the tenancy lint.
2. Demo seed (`scripts/seed-demo.ts`, clone-editable): a provider, a client, a platform admin (TOTP-enrolled), and one
   job run twice: happy path, then dispute → split. PRD success metric: a seeded month (30 providers, 120 clients,
   200 jobs, 15 disputes) ends every job in a terminal state with a balanced ledger. That is a test to write.
3. Watch: after `prisma migrate dev`, revert the `migration_lock.toml` header (D-002).

## Queue (PRD phasing)

1. ~~Tenancy + listings/search~~
2. ~~Job lifecycle + escrow ledger~~
3. ~~Blind reviews + disputes~~
4. Threads; P1 only if time allows. Capstone demo: one job run twice, happy path then dispute, with the ledger balanced both times.
