# Tradepost demo script

A two-sided home-services marketplace. Clients book pros; the platform holds the money until the work is
confirmed; disputes go to a platform admin. Runs locally on **:4200**. It is not deployed.

Every command and screen below was run against the seeded database on 2026-09-26, and every command was re-run
clean on 2026-09-28 against `v1.2.0` (D-016): health check, `/demo`, `npm test` (212/212), lint, typecheck and drift.

## Setup (once, about 2 minutes)

```bash
npm run db:setup                                   # creates tradepost + tradepost_test, writes .env.local (DEMO_MODE=1)
npx dotenv -e .env.local -- prisma migrate deploy  # applies migrations to the dev database
npm run seed:demo                                  # 6 demo users, 2 listings, the capstone (safe to re-run)
npm run dev                                        # http://localhost:4200
```

Check: `curl -s localhost:4200/api/health` prints `{"ok":true}`, and `/demo` lists six accounts.
`npm run seed:demo -- --month` adds the PRD's seeded month (30 providers, 200 jobs, 15 disputes). Skip it for a
live demo: it fills search with "Month listing" rows.

## Accounts

There are no passwords. `/demo` signs in any seeded user with one click, MFA already passed, and only while
`DEMO_MODE=1` (set in the gitignored `.env.local`). Only the seed script can mark a user as demo.

| Account | Role | Use it for |
|---|---|---|
| `client@tradepost.demo.test` | client (Dana Whitfield) | search, book, confirm, dispute |
| `owner@brightline.demo.test` | owner of Brightline Plumbing | accept, start, complete |
| `owner@fernway.demo.test` | owner of Fernway Cleaning | the other tenant, for the isolation stop |
| `ops@tradepost.demo.test` | platform admin | resolve disputes |

`admin@` and `member@brightline.demo.test` exist for role checks. The member sees Brightline's jobs and can message
the client, but has no accept, cancel, dispute, review or listing controls (D-009). Real logins use a magic link plus TOTP; the
demo TOTP secret is `JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP` (public and fixed, and the seed refuses a cloud database).

## Screens

Use two browser profiles, or a private window for the second account. Signing in replaces the session cookie.

### 1. The finished capstone (client)
Open `/demo`, click `client@tradepost.demo.test`, then go to `/jobs`.

You see one Brightline job booked twice, both **closed**:
- **Job 1, confirmed.** $185.00, $166.50 paid to the pro, $18.50 fee. Both 5-star reviews are visible.
- **Job 2, disputed then split.** $74.00 refunded, $99.90 paid to the pro. Three messages in the thread.

Say: "Same job, run through the real state machine twice. Every dollar is a ledger row, and the rows always sum to
what was held."

### 2. Book a new job (client)
Go to `/search`. Category `plumbing`, latitude `30.2672`, longitude `-97.7431`, today's date, then Search.
Click **Request** on *Leak repair & fixture installs*. It appears in `/jobs` as **requested**.

Say: "Search ranks by distance and rating. Location is typed lat/lng for now."

### 3. Provider accepts and works it (Brightline owner)
Sign in as `owner@brightline.demo.test`, go to `/o/brightline/jobs`. Click **Accept**: the $185.00 is now held
by Tradepost. Then **Start**, then **Mark complete**.

Say: "The provider can never release funds. Only the client's confirmation, or the 72-hour auto-confirm, can."

### 4. Client confirms, or disputes
Back as the client at `/jobs`, on the completed job:
- **Confirm the work is done** releases the payment (less the 10% fee) and opens the 14-day review window.
- Or open **Dispute** ("Freezes the money"), write a statement, **Open a dispute**. The payment freezes.

For the dispute path, sign in as the Brightline owner and add a provider statement under the same disclosure.

### 5. Admin resolves (ops)
Sign in as `ops@tradepost.demo.test`, go to `/admin/disputes`. You see both statements and the frozen amount.
Click **Read the message thread** (the read is audit-logged), then enter a split refund, e.g. `74`, and
**Resolve with split**. The rest is released to the provider less the 10% fee.

Say: "Frozen funds move only by an admin resolution, and that resolution is audit-logged."
If the queue says *No open disputes*, that is the seeded one already resolved. Run stop 4 first.
Under **Resolved disputes**, open any case: the statements, the thread and the refund are still there, and that read
is audit-logged too.

### 6. Reviews are blind (client, then provider)
On a closed job, submit the client review. The provider's page shows nothing of it until they submit theirs or
14 days pass. Once both are in, each sees the other's.

### 7. Tenant isolation
As the Brightline owner, open `/o/fernway/jobs`. The answer is a **404**, not a 403: another provider's row does
not reveal that it exists. As the client, open `/admin/disputes`: also 404.

## Proof it holds

```bash
npm test          # 212 tests on local Postgres tradepost_test, including the seeded-month invariant
npm run lint && npm run typecheck && npm run foundation:drift
```

`tests/integration/seed.test.ts` runs 200 jobs and 15 disputes through the real transitions on the injected clock
and asserts every job ends terminal with a balanced ledger.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/demo` is a 404 | `DEMO_MODE` is unset | `grep DEMO_MODE .env.local` should print `DEMO_MODE=1`; restart the server |
| `/demo` says no demo users | not seeded | `npm run seed:demo` |
| Search shows "Month listing" rows | the month seed ran | fine to demo, or drop and re-create the dev DB and seed without `--month` |
| Port 4200 in use | a stale server | `lsof -ti :4200 \| xargs kill` |
| `/admin/disputes` shows nothing | no open dispute | open one at stop 4 |
| Seed script refuses to run | `DATABASE_URL` is not local | point `.env.local` at local Postgres |

## Concede before you're asked

- **Payments are simulated.** The ledger is real and balanced; no card is charged and no money moves. Nothing in the job flow calls Stripe.
- **Not deployed.** Local only, demo accounts only.
- **The 72-hour auto-confirm is proven in tests, not on screen.** It runs from `/api/cron` on the injected clock. Locally `CRON_SECRET` is unset, so the route refuses. To show it, point at the seeded-month test.
- **The design pass (D-011) covers tokens, type, the job card and the header; there is no geocoder.** Two state machines,
  the ledger and the guards were the scope, and the ledger overrides the design where the two disagreed.
- **P1 is cut.** No evidence uploads and no provider payouts.
- **Reviews and statements read as text only.** Disputes take a written statement, not photos.
