# NEXT

## ▶ Next session here: foundation FR-09..11 tooling → release v1.1.0 (Opus)

**Decided 2026-09-26 (Shane): queue all of it for a fresh session; nothing was changed in code.** Findings, confirmed in source:
`audit/FOUNDATION-REVIEW-2026-09-26.md` (no HIGH, 11 MED, 8 LOW). Order:
1. ~~**FR-01 first**~~ **Done 2026-09-27, tagged `v1.0.2`** (lease claim, send outside tx, 15s fetch timeout; 3 new tests, 3 mutations red, 125 pass). Was: outbox sends inside a 5s interactive tx; a slow provider → delivered, not recorded, re-sent every cron run
   and blocks the queue. Callboard's cron is `*/5`, so this is the live risk. Worth its own patch tag (v1.0.2) if the rest runs long.
2. ~~FR-02..05~~ **Done 2026-09-27, tagged `v1.0.3`** (`8e4dd35`; 18 mutations red, 133 pass + 10/10 e2e, check-modules green). Clone notes added to each clone's NEXT.md (uncommitted there, beside the v1.0.2 note).
   Choices: pending-MFA TTL 10 min; wrong-code cap 20/user/UTC day; invite caps 50/sender, 100/org, 5/recipient per day; the cancel hook lives in clone-owned `src/app/org-hooks.ts` (core may not import modules); concurrent pending checkouts still make two subs (ponytail note, logged).
3. ~~FR-06/07/08~~ **Done 2026-09-28, untagged (CHANGELOG *Unreleased (1.1.0)*)**: `unguardedEntrypoints()` + `// public: <reason>` markers (14 files), glob all of `src/` + inline `'use server'` refused, id-like untagged fields throw (`notRef()` opt-out). 7 mutations red, 139 pass. Tag v1.1.0 after FR-09..11, then add each clone's upgrade note (their NEXT already says v1.1.0 follows).
4. FR-09/10/11 tooling (diff-scoped patch excuse, nav-link marker, port-table + double-run guard in `new-project`).
5. LOWs as time allows. Each fix: test red without it (mutation-check), CHANGELOG, tag, then add each clone's upgrade to its own NEXT.md.
Clones: tradepost (4200), pulseboard (4500), callboard (4600) — each upgrades in its own session.

**Also done 2026-09-26:** clinic D-32 (group leader writes notes for own group only, `f35252c`) and rental SEC-16 / D-266
(unrouted inbox portfolio-wide only, `58a0b5b`); CI green in both. Both repos had another session active at the time.

**Decided 2026-09-23: urgent live-security fixes run before foundation M0.** Each one is its own session, run in
**that project's folder** (one session per project). The details for each are in that repo's *Security findings*
section and in `audit/<repo>.md` here.

**Session pick 2026-09-25: item 5 (storage SEC-01/02) runs on Opus, in the storage business folder, not here. Foundation has nothing open; safe to /clear.**

**2026-09-26: Opus K4 pass done** (`audit/K4-SWEEP-2026-09-26.md`, scorecard v7). Rental K4 ✗ (3 HIGH, confirmed in source), clinic K4 ✗ (1 HIGH),
alongside ✔, reservations N/A. Rental's Re-check processed: 10/14, not the 14/14 its own NEXT claims (K1, K6, K11 still ✗).
Storage's Re-check stays queued in the artifact db until its SEC-01/02 edits are committed (they were uncommitted in flight at the time).
Carried notes moved to `BACKLOG.md` (F-01, F-02). Items 9–10 were fixed the same day (scorecard v8: rental 11/14, clinic 10/14).

## Queue (in order)

1. ~~**clinic: SEC-01 HIGH.**~~ **Live** (verified 2026-09-23): env vars set, pushed (`5f24c71`, in sync with origin),
   `curl -I https://clinic.labintelligence.co/` returns 401 with a Basic challenge, and the cron route returns 401 with no challenge. gitleaks is clean (196 commits),
   so `clearpath` was **made public** on 2026-09-23. **Done.**
2. ~~**event toolkit: SEC-01 HIGH.**~~ Fixed (`2de11b8`); SEC-02 fixed too. **The repo is still blocked from going public:**
   gitleaks flags a literal Vercel bearer token in `.claude/settings.json` (plus the ` 3`/` 4` copies), commit `b8310aa` (2026-08-14).
   Shane: revoke that Vercel token. The files are no longer tracked, but they are not gitignored either, so add `.claude/settings*.json` to `.gitignore`. The token stays in history, so revoking it is the real fix.
   SEC-03/04 (MED) are in progress in that folder (uncommitted edits).
3. ~~**claude-dashboard: SEC-01 HIGH.**~~ Fixed (`a009fce`, pushed). The server binds to 127.0.0.1 and a LAN connection is refused. SEC-02 and OPS-01 are covered by the same fix. **Done.**
4. ~~talk4me~~: **deferred to the end of the queue** (Shane, 2026-09-23). See item 8.
5. **storage business: SEC-01, SEC-02** (webhook re-apply; cross-facility echo). Model: Opus (money). The repo was made private on 2026-09-23 because of these findings; make it public again once both are fixed.
6. ~~design bridge~~: dead project (the API it needed cost too much), 2026-09-23. The repo stays private. SEC items dropped.
7. ~~**Foundation M0**~~ **Done** 2026-09-23 (Shane chose to run it before storage). The repo `shanelabountyai/saas-foundation` is **private**.
   The scaffold is pushed, and spikes S1–S3 all passed (the results are in spec §0). CI is lint + typecheck. Port 4100 is claimed in `~/.claude/CLAUDE.md`.
   **M1 core platform: done** 2026-09-23 (env/clock/log/db + guard, headers, health, error pages, vitest, prod-build e2e, CI; INV-14, 15 (public + api), 18, 20 green).
   **M2 Auth: done** 2026-09-23 in one session (est. 2). INV-05/07/09 (scoped to M2), 13, 15 (signed-in), 17, 23, 24, 25, 26 (TOTP) are green,
   and each was mutation-checked red. The first migrations exist: core, billing and notifications, each separate (D-14d). Build choices are in spec **D-14**.
   **M3 Tenancy + authz: done** 2026-09-23 in one session (est. 2). INV-01/02/03/04/22 run through the glob harness
   (`tests/invariants/harness.ts`; six negative controls, and mutation-checked red on real code), plus INV-05 (membership removal),
   06, 07 (invite), 09 (invite accepts), 19, 21 (including concurrent demotion), 26 (deletion) and 28, all green. D-13 confirmed; build choices are in spec **D-15**.
   **M4 Share links: done** 2026-09-23. `Project` is the example resource, with `core/share/{links,project}.ts`, `/s/[token]` and `/o/[org]/projects`.
   INV-07 (share link), 08, 09 (share reads) and 15 (share route) are green, each mutation-checked red (7 mutations). The e2e sweep passed 8/8. Build choices are in spec **D-16**.
   **M5 Cron + secret hygiene: done** 2026-09-24. `core/cron.ts` (`isAuthorizedCron`: fails closed, `safeEqual`, header only), hourly `/api/cron`
   (also sweeps `RateLimit` rows older than a day), `CRON_SECRET` in env + `.env.example`, `vercel.json` cron. INV-10/11/16 green, 5 mutations red. 84 unit/integration tests pass.
   **M6 Billing: done** 2026-09-24. `modules/billing/{provider,webhook}.ts`, `/api/webhooks/stripe`, `/o/[org]/settings/billing` (+ nav link),
   mock provider when no key. INV-12 green (13 tests, 8 mutations red, including the SB "any row = duplicate" bug and a dropped row lock).
   98 unit/integration + 9/9 e2e. **Found and fixed a defect present since M1**: Prisma writes were stored 5–6h off in a non-UTC Postgres zone (D-17g).
   Build choices are in spec **D-17**.
   **M7 Notifications: done** 2026-09-24. `modules/notifications/{outbox,sms,templates}.ts`, drain + 7-day sweep in `/api/cron`, Twilio/SMS env keys.
   11 new tests (109 total pass), 4 drain mutations red (no row lock, no backoff, no attempt cap, no sentAt filter). Build choices are in spec **D-18**.
   **M8 Demo, clone tooling, release: done** 2026-09-25. `/demo` + `seed:demo` (INV-27, 3 mutations red), `new-project`, `db:setup`, `foundation:drift|status|check-modules`
   (CI job `modules-removed`), README, legal stubs, CHANGELOG, CLONES. 122 tests + 10/10 e2e. **Tagged `v1.0.0`, then `v1.0.1`** (the acceptance run found the README's
   `git checkout -b main` fails in a fresh clone; a pushed tag is not moved, so the fix is a patch release). Clone from **v1.0.1**. Acceptance run from a clean clone:
   install to a working `/demo` sign-in took about 10s warm-cache (limit 30 min; not measured cold). Build choices in spec **D-19**.
   **M9 scorecard: done** 2026-09-25, artifact https://claude.ai/artifact/TognMvisj8T9GNQGtE9MbJ. Foundation row all ✔ (122 tests). All rows re-scored 2026-09-25 by Sonnet agents (audit/rescore/*.json; design bridge stays baseline). K3/K4 spot-checks flagged; the Opus K3/K4 pass has not run. Per-project Re-check buttons queue requests in the artifact db (docs checks/<project-id>); process them by reading with ArtifactData, re-running that project's scorer, then writing doneAt + summary back.
   **Clinic K11/OPS-04 cleanup landed 2026-09-25** (`clinic` a2e07eb: zod env schema, OPS-04 was already satisfied). Clinic is now 10/14. `audit/scorecard.json` and `build-scorecard.py` are updated and committed, but the artifact was republished (v5) with clinic at 10/14. **Next: storage (item 5)**, then talk4me. Earlier: storage (item 5) and talk4me (item 8).
   - Not built, on purpose: `scripts/seed.ts`, `scripts/drain-outbox.ts` (nothing needs them).
   - Shane, optional: to try real Stripe test mode, set `STRIPE_SECRET_KEY` (sk_test_), `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` in `.env.local`
     and forward with `stripe listen --forward-to localhost:4100/api/webhooks/stripe`. Not needed for M7.
   - Carried notes: an audit-log viewer (`audit.read`) and `/o/[org]/settings/security` are not built. Neither is in any milestone yet, so add them to `BACKLOG.md` if wanted.
   - The harness takes ~2.5s on an idle machine and ~80s under a sibling project's sweep (load 45). That is CPU contention, not a hang.
8. **talk4me: SEC-01 HIGH** (deferred here from item 4 on 2026-09-23). Cap `api/tts.ts` at about 500 chars, allowlist voice ids,
   add a Vercel Firewall rule. Model: Sonnet. After it is fixed, make the `talk4me` repo public.
9. ~~**rental business: K4-R1/R2/R3 HIGH**~~ **Fixed 2026-09-26** (`6d75d45`, SEC-09–15, CI green). Open in that repo: SEC-16 (unrouted inbox, a design
   question for Shane), the K4 LOWs, and K1/K6/K11 (tenant sign-out not server-side, same-origin referrer + no no-store on token pages, env schema covers 6 vars).
10. ~~**clinic: K4-C1 HIGH**~~ **Fixed 2026-09-26** (`8c060a5`, SEC-07–11). Also fixed: clinic CI had been red at `npm ci` since SEC-06 (`b72b1f3`, 09-23) —
   `a4d11ba` — which hid a date-rotted e2e spec, fixed in `62d7f1c`; CI green. Open in that repo: whether a group leader may write notes for attendees
   they don't treat (Shane), and two LOWs (forms for any client; not-found vs forbidden oracle).

**Shane-only, no code (still to do):**
- Revoke the Vercel token leaked in event-toolkit history (`b8310aa`, `.claude/settings.json`). This blocks making the repo public.
- ElevenLabs spend cap (talk4me).
- Rotate or remove the live Anthropic key and Neon credentials in `use-case-support-ticket-deflection/.env.local`.

## Where things are
- Spec (APPROVED v2): `FOUNDATION_SPEC.md`. Plan (APPROVED, M0–M9): `IMPLEMENTATION_PLAN.md`. Both were revised on 2026-09-23 after a Codex review (D-10 to D-12, INV-28, tighter S1–S3), and the revision is approved.
- Portfolio audit baseline for the M9 scorecard: `audit/` (17 reports on the K1–K14 checklist).
- SEC items were appended (uncommitted, for each repo's own session to commit) to:
  - storage, Bookable and rental: `docs/prds/06-backlog.md`
  - Countertop and reservations: `docs/backlog.md`
  - clinic, groundwork and talk4me: `NEXT.md`
  - alongside: `BACKLOG.md`
  - showcall: `docs/backlog.md`
  - event toolkit, design bridge, claude-dashboard and the three use-case repos: `SECURITY_BACKLOG.md`
  - Use-Case Studio: its backlog file
