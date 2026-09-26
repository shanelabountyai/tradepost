# NEXT

**Capstone demo seed done 2026-09-26** (D-007). `npm run seed:demo` seeds two providers, a client, a platform admin
(`ops@`) and the capstone. That is one Brightline job run twice: confirmed, then disputed and split, each with a
thread and a balanced ledger. `-- --month` adds the PRD's seeded month (200 jobs, 15 disputes), which
`tests/integration/seed.test.ts` asserts ends terminal and balanced. The gate is green: lint, typecheck, drift,
168/168 tests and the build.

## Next item: project closure (global definition of done)

1. ✅ done 2026-09-26 — `docs/DEMO.md`: screen by screen, from the seeded accounts in `npm run seed:demo`. Sign in as `client@`, then the
   Brightline owner, then `ops@` at `/admin/disputes`. It needs `DEMO_MODE=1`. Run every command in it once.
2. The exec brief (`exec-brief` skill): *Tradepost in Brief*.
3. LinkedIn posts in the Ledger. Mine `docs/decisions.md` "Found:" lines first.
4. Record the artifact URLs in `docs/RELEASE_NOTES.md` or here.

P1 stays cut unless there is time after closure.
