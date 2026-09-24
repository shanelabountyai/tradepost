# NEXT

**Decided 2026-09-23: urgent live-security fixes run before foundation M0.** Each one is its own session, run in
**that project's folder** (one session per project). The details for each are in that repo's *Security findings*
section and in `audit/<repo>.md` here.

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
   **Next here: M3, Tenancy + authz** (`IMPLEMENTATION_PLAN.md` §1). Model: **Opus**. Carry-overs from M2:
   - The plain `'use server'` exports in `src/app/(public)/login/mfa/actions.ts` and `src/app/account/security/actions.ts` must be
     rebuilt on S2's **`userAction`** twin (spec S2 rule 4), or the INV-01 harness fails them.
   - Sign-in lands on `/account/security`. M3 routes a user with no memberships to `/onboarding` instead (`src/app/(public)/login/redeem/route.ts`).
   - INV-22 (owner/admin must be MFA'd) belongs in `requireOrg`. `disableTotp` already refuses owners and admins.
   - **D-13 confirmed** 2026-09-23: clone app tables add their back-relations to `core.prisma`, each line ending in `// app`.
8. **talk4me: SEC-01 HIGH** (deferred here from item 4 on 2026-09-23). Cap `api/tts.ts` at about 500 chars, allowlist voice ids,
   add a Vercel Firewall rule. Model: Sonnet. After it is fixed, make the `talk4me` repo public.

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
