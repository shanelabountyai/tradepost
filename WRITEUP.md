# Project Write-Up: Tradepost

**Repo:** https://github.com/shanelabountyai/tradepost
**Live demo:** https://tradepost.labintelligence.co (shared password; sign in at `/demo`)
**Built with:** Claude Code + Next.js 16, Prisma 7, Postgres, on the SaaS foundation template (v1.0.1 → v1.2.0)
**Status:** Shipped 2026-09-29 · Last synced: 2026-10-03

---

## The Business Problem

A local-services marketplace (think Thumbtack or Angi for plumbers and cleaners) has to earn trust from two sides at once.
The client won't pay up front without knowing the money comes back if the job goes wrong. The provider won't take
the job without knowing the money is there. Neither side will leave an honest review if the other can read it first and
retaliate. Without software that holds the money and keeps reviews sealed, the platform is just a phone book.

## What I Built

- Clients search providers by category, day of the week, distance and minimum rating, and request a job on a date
- Money is held when the provider accepts. It goes to the provider only when the client confirms the work, or
  automatically 72 hours after completion. The provider can never release it.
- Either side can open a dispute, which freezes the funds. A platform admin reads both statements and the message
  thread, then splits the money. Every admin read and resolution is audit-logged.
- Reviews are blind. Neither party can see the other's review until both are in or the 14-day window closes. The party
  a review is about can report it to an admin moderation queue.
- Providers get an earnings dashboard (held / paid out / fees), an inbox split into "needs your action" and everything
  else, and email and SMS notifications for requests and messages
- Clients can save a search and get emailed when a new matching provider lists. Cancelling after acceptance costs the
  client a 20% fee, while a provider who cancels refunds the client in full.

## How It's Built

A clone of my own SaaS foundation template, which supplies auth (magic link + TOTP), an append-only audit log, cron,
an injected clock and a notification outbox. Each provider business is an **org**, so `providerId` is the `orgId`, and
clients are plain users. 10 app models sit in their own Prisma schema file. Two state machines carry the product: the job
lifecycle (`requested → accepted → in_progress → completed → closed`, plus decline, cancel and dispute) and the
escrow ledger. Both live in one transition table in `src/lib/jobs.ts`, which is the only way a job can move.

**Key design decisions**
| Decision | Alternative considered | Why I chose it |
|---|---|---|
| A tenancy layer (`src/lib/tenancy.ts`) that injects the provider filter into every query, plus a lint test that fails the build on any raw query outside it | Writing `where: { orgId }` by hand at every call site, which is the template's convention | One forgotten filter leaks another business's jobs. Injection makes that hard to do, and the lint catches the rest. |
| Another provider's row returns **404**, never 403 | 403 Forbidden | A 403 confirms the row exists. A 404 tells an attacker nothing. |
| Money as append-only ledger rows in integer cents. The fee rounds down and the provider gets the remainder, so `release + fee = hold` exactly. | A `status` and a `balance` column on the job | Rows are an audit trail a balance can't be. The invariant "the rows sum to the hold" is asserted over every job after every test. |
| Blind reviews enforced structurally: `reviewsVisibleTo(party)` is the only way to read reviews, and the lint flags any `include: { reviews }` outside it | Filtering in each page | A page author can't accidentally leak an unpublished review. Each guard was deleted in turn to prove a test goes red. |
| Every transition writes `where: { id, status: <the status read> }` | Read, check, then write | A double-click or the cron racing a client's confirm matches zero rows and is refused, instead of paying out twice. |
| Platform admin as a `PlatformAdmin` table behind MFA, returning 404 to everyone else | An env allowlist, or a special "platform" org | Doesn't drift per environment, doesn't blur a provider org with the platform, and the admin surface doesn't announce itself |

## Skills Learned / Functions Unlocked

- **Two-sided tenancy.** A provider is scoped by org, a client by user id, and a person can be both. The two paths are
  deliberately separate so a dual-role user's provider view never bleeds into their client bookings. See
  `providerDb` and `clientDb` in [`src/lib/tenancy.ts`](src/lib/tenancy.ts) and the lint in
  [`tests/unit/tenancy-lint.test.ts`](tests/unit/tenancy-lint.test.ts).
- **Escrow as a state machine.** The first project where *who* may move money is as important as *how much*. The
  transition table assigns a fixed set of actors to each move, so "the provider releases funds" isn't a check that
  could be forgotten: no such move exists. See [`src/lib/jobs.ts`](src/lib/jobs.ts).
- **Mutation-checking my own tests.** For every guard, I deleted it and confirmed a test went red. This caught a race test
  that passed with the guard removed: three `confirm`s fired through `Promise.allSettled` ran one after another inside one
  process, so nothing actually raced. I replaced it with a stale-read replay, which fails without the guard (D-004).
- **Time as an input.** Auto-confirm (72h) and the review window (14d) read an injected clock. That let the demo seed
  run a full simulated month through the real code paths: 30 providers, 120 clients, 200 jobs and 15 disputes, each
  ending terminal with its ledger balanced. See [`scripts/seed-demo.ts`](scripts/seed-demo.ts).
- **AI red-teaming as a gate.** Two full feedback runs (three persona agents, an Opus red team and a gap analysis)
  attacked the four hard rules after each major change. All four held both times. The second run found the bug below.

## The Hardest Bug

**Deleting a provider could leave a business with live jobs and no billing.**

The foundation's v1.0.3 merge added a hook that cancels a provider's Stripe subscription *before* deleting the org.
A provider with job history can't be deleted, because ledger rows are append-only and restrict deletion. So for that provider, the
delete failed *after* the cancel. The org stayed, no longer billed. I added a guard that refuses the delete if the
provider has any jobs, and a test that the cancel is never called.

The second AI red-team run (D-013) then found that the guard could be raced. The job count and the delete weren't
under one lock, so a client could book in the gap between "zero jobs" and the delete. The delete itself
runs in template-owned code that I can't edit. So rather than locking the delete, I closed the only door in: one
transaction counts the jobs *and deletes every listing*. Every job needs a listing, so once that commits nothing can
be booked. A booking already in flight holds a lock on its listing, so the listing delete waits for it, fails on the
foreign key and rolls back, and the provider delete is refused. Two race tests pin it, and both fail with the
listing delete removed (D-014).

**What I'd instrument next time:** any check-then-act across a boundary I don't own gets a race test on day one, not
after a red team finds it. The upstream fix, running the hook inside the delete's own transaction, is queued for the
template.

## What I'd Do Differently

- **No real payments.** The hold is a ledger fact, not a Stripe charge. The PRD made payments a non-goal, but a real
  marketplace would put a payment provider's escrow or delayed payout behind the same ledger.
- **Search still takes typed coordinates.** The listing form geocodes an address (U.S. Census API), but `/search` and
  saved searches don't yet, and the distance filter runs in memory after the SQL narrowing. Fine at demo scale. A
  bounding-box `WHERE` is the upgrade.
- **Dispute evidence is text only.** File upload was cut from P0 to keep the dispute item small. The PRD wanted it.

## By the Numbers

- **232** unit, integration and invariant tests, plus **10** end-to-end tests against a production build
- **~2,900** lines in `src/app` and `src/lib` (some of them template pages), **~3,450** lines of tests
- **10** app models, **18** migrations, **25** logged decisions (`docs/decisions.md`)
- **5** build days (2026-09-25 → 09-29), all of P0 plus the four P1 items (earnings, cancellation fee, saved
  searches, review moderation)
- **2** AI feedback runs, **35** findings, **0** breaches of the four hard rules
- Seeded month: **200** jobs, **15** disputes, and every job's ledger balanced

---

*Part of my Claude Code build log: https://claude.ai/artifact/28KeGV3xfBwcBuoMEQjFMj*
