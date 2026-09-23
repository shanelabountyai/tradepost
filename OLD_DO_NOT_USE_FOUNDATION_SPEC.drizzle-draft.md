> # ⛔ OLD — DO NOT USE
> Superseded 2026-09-23 by `FOUNDATION_SPEC.md` (v2: Prisma 7 + magic link + TOTP).
> Kept only as a record of the Drizzle + Auth.js draft. Do not build from it, cite it, or copy from it.

# SaaS Foundation — Spec

Status: **DRAFT, awaiting approval** · 2026-09-23 · nothing is built until this is approved.

A reusable starter template (clone per new project) on **Next.js 16 + Drizzle + Neon + Auth.js v5**,
distilled from seven existing builds. Evidence paths below are relative to `~/Projects/`.

**Verification labels.** `✔` = I re-read the cited lines myself this session. Unmarked = reported with
file:line by a read-only audit agent, not re-checked by me. `UNVERIFIED` = nobody confirmed it.

---

## 0. Decisions log

| # | Decision | Why |
|---|---|---|
| D-1 | Reusable **starter template**, not a shared package | No forced migration of the six live repos; each clone owns its code. |
| D-2 | **Drizzle + Neon + Auth.js v5 on Next 16** (not 15) | Stated direction, on the Next major the other five already run (`Restaurant ordering/apps/web/package.json` next 16.3.3; `groundwork/package.json` ^16.3.4). Use-Case Studio is the only repo on this data stack (`usecasestudiofiles/use-case-studio/package.json`: drizzle-orm ^0.44, next ^15.3). |
| D-3 | v1 scope: auth + orgs, roles + audit log, email + notifications, Stripe billing | Chosen 2026-09-23. Billing and notifications ship in v1 as **optional modules** (§4). Re-confirmed 2026-09-23 after PO review (full scope, not core-MVP). |

**Revisions after senior-PO review, 2026-09-23. These supersede D-1/D-2 where they conflict; §§4–11 are not yet rewritten to match.**

| # | Decision | Why |
|---|---|---|
| D-2′ | **ORM: Prisma 7 + `@prisma/adapter-pg`** on Next 16 + Neon. Replaces Drizzle. | Portfolio is 12 Prisma / 2 Drizzle; the last three new apps (clinic, groundwork, showcall) all chose Prisma 7 + adapter-pg; the two Drizzle repos are idle since August. The spec's own §9 shows the security gaps are ORM-independent, so Drizzle bought no security. |
| ~~D-4~~ | ~~Auth: rental's Auth.js v5 JWT + watermark, password + TOTP.~~ Superseded by D-4′ the same day. | Rental's authn is ~1,750 lines, all security-relevant code owned by us (Auth.js's Credentials docs: "we recommend … Email Magic Links, or WebAuthn (Passkeys) … instead"). |
| D-4′ | **Auth: magic link + TOTP, no passwords, no Auth.js.** groundwork's hashed DB sessions + POST-to-spend links (`groundwork/src/session.ts`, 121 lines incl. login pages) + rental's TOTP and sealed secrets (`packages/core/auth/totp.ts`, `secret-box.ts`). TOTP required for owner/admin roles. | Removes the whole password threat class (stuffing, reset, lockout, breach checks) instead of guarding it; ~300–400 lines already written and tested in two repos; no beta dependency. Accepted cost: every sign-in goes through email (30-day sessions soften it). Passwords stay a future module (port from rental). |
| D-5 | **Per-repo security fixes (§9) are separate backlog items** in each repo, not part of this project. | Storage webhook, groundwork log leak and Bookable IDORs ship independently of the template. |
| D-6 | **Use-Case Studio is frozen**; only its 3 security items are fixed in place (hashed + expiring share tokens, fail-closed intake, move off :3000). | Idle since 08-14; convergence would now mean an ORM port too. |
| D-7 | **Clones stay current via a shared core package, introduced after clone #3.** Until then: tagged template versions + `FOUNDATION_VERSION` in each clone. | Reopens D-1 on a timer: template for the first three clones, then extract `core/`. |
| D-8 | **Demo and e2e sign-in: `DEMO_MODE` sign-in-as for seeded users**, refused in production unless explicitly enabled. | Keeps `DEMO.md` workable and Playwright free of email; under D-4′ it writes a hashed session row for a seeded user (groundwork's e2e already signs in by inserting a token, `e2e/sign-in.ts:10-20`). |

---

## 1. Inputs

| Code | Repo | Stack today | Notes |
|---|---|---|---|
| CT | Countertop (`Restaurant ordering`) | Next 16, Prisma 6, monorepo | single restaurant, shared staff passcode |
| BK | Bookable (`apptbasedservice`) | Next 16, Prisma 6, monorepo | custom HMAC session, `businessId` column |
| RB | rental business | Next 16, Prisma 6, next-auth v5 JWT | most mature auth/RBAC of the set |
| SB | storage business | Next 16, Prisma 6, next-auth v5 JWT, Stripe SDK | 97 models, 124 migrations |
| GW | groundwork | Next 16, Prisma 7, single app | custom magic-link auth, Stripe via fetch |
| UCS | Use-Case Studio (`usecasestudiofiles/use-case-studio`) | **Next 15, Drizzle, Neon, Auth.js v5 DB sessions** | origin of `toPublicBrief` |
| BX | Boxloop (`Boxloop sub and membership`) | **no code**, PRD only | contributes conventions, not implementations |

---

## 2. Pattern matrix

Consistency: **H** = same approach everywhere it appears, **M** = same idea / different mechanics, **L** = divergent.

| Pattern | Present in | Consistency | Best implementation → verdict |
|---|---|---|---|
| **Auth / session** | all 6 coded | **L** — passcode cookie (CT), HMAC cookie (BK), Auth.js JWT + Credentials (RB, SB), custom magic link + DB sessions (GW), Auth.js DB sessions + adapter (UCS) | **UCS shape** (Auth.js + Drizzle adapter, `strategy: 'database'`) for revocation-by-delete; adopt **GW's GET-shows-button / POST-spends** link handling (`groundwork/app/login/[token]/page.tsx:3-17`) so mail scanners can't burn links. RB's JWT `sessionsValidFrom` watermark (`rental business/apps/web/auth.ts:245-311`) is the fallback if JWT is ever forced. |
| **Route protection** | all | **L** — middleware only (CT), in-action only (BK, GW), both (RB layout floor, SB proxy, UCS) | **Both, with the guard authoritative in every page/action/route** and proxy as an optimistic redirect only. CT's middleware-only boundary holds today only by Next internals (agent read of Next source; CT `apps/web/middleware.ts:9-13`). |
| **Per-user / tenant isolation** | BK, RB, SB, GW, UCS | **L** — ad hoc per query (BK, GW), central scope helper (RB `lib/auth/scope.ts:22-68`, SB `lib/rbac/authorize.ts`), per-file `owned()` predicate (UCS `api/use-cases/[id]/route.ts:10`) | **RB/SB central helper that fails closed** (empty scope ⇒ zero rows, never "no filter"), expressed as UCS's Drizzle predicate: one `inOrg()` in core. BK's ad-hoc scoping is the cautionary tale (§3). |
| **RBAC** | BK (owner/staff), RB, SB | **M** | **RB**: pure `can()` in core, permission list, unknown keys dropped (`packages/core/rbac/*`). Re-load membership per request (RB jwt callback, SB `lib/rbac/actor.ts:48`, BK session re-read). |
| **Schema conventions** | all | **L** — ids: uuid (CT, UCS), cuid (BK, RB, SB, GW); naming: camelCase no map (CT, BK, RB, GW), snake via `@@map` (SB), snake columns (UCS app tables); `updatedAt` absent in GW | **uuid `defaultRandom()`, snake_case columns via Drizzle `casing`, `timestamptz` everywhere, no soft delete by default, integer cents (BX PRD:52), app-supplied clock (BX PRD:136)**. |
| **Public share links** | CT `/status`, BK `/manage`, RB `/pay` etc., SB `/pay`, UCS `/s` (GW has none — portal is session-gated) | **L** | Compose the best of three: **UCS projection + headers** ✔ (`src/lib/sharing.ts:32-45` redacts by default on `blankCase()`; `next.config.mjs:3-18` no-referrer / noindex / no-store) · **BK/RB/SB hashed tokens with expiry** (UCS stores the raw token as PK ✔ `src/db/schema.ts:98-99`; CT has no expiry) · **RB DB rate limiter** (`lib/auth/store.ts:45-75`, advisory lock + upsert; UCS's is per-instance memory). |
| **Rate limiting** | BK, RB, SB (DB); UCS (memory); CT, GW (none/cooldown only) | **L** | **RB Postgres limiter**, keyed per IP *and* per identity, applied to every unauthenticated write. |
| **Payments** | SB (SDK), RB + GW (fetch), CT (mock seam), BX (mock seam, PRD) | **M** — all verify signatures; idempotency differs | **Raw-body verify + timestamp window + event-claim table** (GW `src/billing/stripe.ts:64-82`, RB `webhook-signature.ts:106-126`), **re-run when `processed_at IS NULL`** (fixes SB gap below), **`Idempotency-Key` on writes** (RB `stripe-adapter.ts:72`), **provider interface with a mock** (CT `packages/db/provider.ts`, BX PRD:102). Use the official SDK for `constructEvent`; fewer hand-rolled crypto lines. |
| **Email / notifications** | RB, SB, GW (Resend + Twilio); UCS (Resend); BK (adapter, no provider); CT (stub) | **M** | **SB gating on `VERCEL_ENV` not `NODE_ENV`** (`lib/comms/provider.ts:190-275`) + **RB/BK kill switch + sandbox redirect** + **GW outbox table**. Never console-log bodies in production (GW gap). |
| **Env / config** | all | **H — uniformly missing**: no repo validates env with a schema; each fails closed per call site | **New**: one zod `env.ts` parsed at boot + a test that `.env.example` keys equal schema keys (UCS `.env.example` omits ≥6 used vars). Keep CT's "unset means locked" (`apps/web/lib/staff-auth.ts:37-45`). |
| **Security headers** | UCS (share route only), BK (manage route), RB (nonce CSP in proxy) | **L** — CT, SB, GW set none (`next.config.ts` in each) | **Global baseline in `next.config` headers()** + RB's per-request nonce CSP as an optional hardening step. |
| **Testing** | all | **H** except UCS — local Postgres, `.env.test` first-wins, prod-build e2e with `E2E_DEV` escape | **GW/RB setup** + **GW cloud-DB guard in code** (`groundwork/prisma.config.ts:10-19`, `src/db.ts:4-10`) + **CT localhost guard on destructive scripts** (`packages/db/local-guard.ts`). UCS integration tests hit a Neon branch — against convention. |
| **Deploy** | all | **L** — `ignoreCommand` present only in RB and GW; absent in CT, BK, SB ✔ (`storage business/vercel.json`), UCS | **RB `apps/web/vercel.json`** (repo-root anchor, `VERCEL_GIT_PREVIOUS_SHA`, deepen, build-on-error). Cron auth: **RB `isAuthorizedCron`** (constant-time, fail closed, 404). |
| **Audit log** | RB (write-once trigger on notice delivery), BX (PRD P0-2) | **M** | Append-only `audit_event`, enforced by a DB trigger, not by app discipline. |

---

## 3. Divergences and security gaps

### 3a. Gaps (fix list per repo; also the source of §8's invariants)

| Sev | Repo | Gap | Evidence | Invariant |
|---|---|---|---|---|
| **MED→HIGH** | BK | Cross-tenant **IDOR** on settings + appointment writes: update/transition by `id` only. HIGH the day a second business exists. | ✔ `packages/db/settings/resources.ts:135-137` (`update({ where: { id: resourceId } })`); ✔ `packages/db/appointments/transition.ts:162-164`; also services.ts:141-150,282,346-356, segments.ts:73-87, providers.ts:101-124, reschedule/close-out/impact actions | INV-02 |
| MED | SB | **Stripe events that fail once are never re-applied**: retry hits PK collision and returns `duplicate:true` without checking `processedAt`. | ✔ `apps/web/app/api/stripe/webhook/route.ts:44-52` | INV-12 |
| MED | SB | **Cross-facility PII read**: confirm-step echo loads lease by id and trusts form `facilityId`, before the domain authz check. | ✔ `apps/web/app/admin/rate-increases/actions.ts:58-69, 225-228` | INV-04 |
| MED | SB | Tenant JWT sessions **not revocable** (no DB re-check, no watermark). | `apps/web/lib/rbac/session.ts:29` | INV-05 |
| MED | SB, BK | **Unauthenticated inventory lock / slot fill**: public checkout holds units 30 min; public booking unthrottled. | SB `(public)/.../rent/route.ts:9-50`; BK `lib/booking/public-actions.ts:341-380` | INV-09 |
| MED | RB | **Unguarded exports in `'use server'` files** (`markNoticeRead`, `sendPrescreenInvite`, `sendShowingInvite`, `propertyForTenant`). Reachability via action ID UNVERIFIED. | ✔ `apps/web/lib/notices/actions.ts:1,524` (takes caller-supplied `leaseIds`); `lib/prospects/actions.ts:187`; `lib/showings/actions.ts:339`; `lib/consent/actions.ts:38` | INV-01 |
| LOW-MED | RB | Secondary id not scoped: `addLeaseTenant` checks the lease, not the tenant. | ✔ `apps/web/lib/leases/actions.ts:1079-1084` | INV-03 |
| LOW | RB | Write actions gate records against a **read**-permission scope. | `lib/scope/current-scope.ts:40` + deposit/expense/vendor-invoice actions | INV-03 |
| MED | GW | **Portal sessions survive a contact change** (house sold → old owner keeps access 30 days). | ✔ `app/dispatch/properties/actions.ts:41-48` (no session delete; `grep portalSession` → none) | INV-06 |
| MED | GW | **Sign-in links logged in production** when a channel is unconfigured. | ✔ `src/notifications/provider.ts:46-52` | INV-13 |
| MED | UCS | `/api/intake` **open when `INTAKE_KEY` unset**; memory rate limit. | `src/app/api/intake/route.ts:26-40,76-80` | INV-11 |
| LOW | UCS | Share tokens **stored raw** (PK); **no expiry**. | ✔ `src/db/schema.ts:98-103` | INV-07, INV-08 |
| MED | CT | Phone verification stub **returns the code to the browser**; staff passcode unthrottled. | `packages/db/verification.ts:59`; `apps/web/app/kitchen/login/actions.ts:16-29` | INV-09 |
| LOW | BK, UCS | Secret compared with `!==` (cron, intake). | BK `app/api/jobs/reminders/route.ts:38`; UCS `intake/route.ts:78`, `worker/route.ts:19` | INV-10 |
| LOW | RB | Resend webhook has no timestamp window (replay); inbound secret accepted in query string. | `packages/core/comms/webhook-signature.ts:96-136`; `app/api/email/inbound/route.ts:113` | INV-12, INV-16 |
| LOW | CT, SB, GW, RB | No Referrer-Policy / frame-ancestors on most routes while bearer tokens live in URL paths. | each repo's `next.config.ts` | INV-15 |
| LOW | SB | Magic link spent on GET (scanners burn it); MFA enrolment enforced only by admin layout. | `app/(auth)/login/magic/route.ts:13-35`; `app/admin/layout.tsx:48` | INV-17 |
| LOW | GW | Last dispatcher can demote/delete themselves. | `app/dispatch/users/actions.ts:62-84` | INV-21 |
| Ops | CT, BK, SB, UCS | No `ignoreCommand` (builds are the bill). UCS runs on :3000, **colliding with storage business**. | ✔ SB `vercel.json`; UCS `package.json` `next dev` | §9 |

**Secrets handling — clean across the set.** No hardcoded live keys, no secret `NEXT_PUBLIC_` vars, only
`.env.example` tracked in every repo. SB `scripts/demo-credentials.ts` holds known demo passwords + a fixed
TOTP seed, guarded by a seed that refuses production (`scripts/seed-demo.mts:1161-1170`) — acceptable per convention.

### 3b. Divergences that the foundation settles (not bugs)

ID type (uuid vs cuid) · column casing · session strategy (JWT vs DB) · Stripe SDK vs fetch · rate-limit store ·
where route protection lives · whether tokens are hashed · whether tests may touch a cloud DB.
Each is decided once in §4–§8.

---

## 4. Module boundaries

**Rule:** `core/` never imports from `modules/`. Modules import core. Enforced by ESLint `no-restricted-imports`.
Deleting a module directory plus its schema file and route must leave a green build.

| Core (always present) | Optional module (v1 ships it; deletable) |
|---|---|
| `env` — zod schema, boot-time parse | `billing` — Stripe checkout/portal, webhook, event claim, `PaymentProvider` interface + mock |
| `db` — Drizzle client, schema, local-DB guard | `notifications` — outbox table, drain cron, SMS (Twilio), templates |
| `clock` — injectable `now()` | |
| `auth` — Auth.js (magic link via Resend + Google), DB sessions | |
| `email` — transport only (magic links need it); sandbox + kill switch | |
| `tenancy` — orgs, memberships, invites | |
| `authz` — `can()`, `requireUser/requireOrg`, `inOrg()` | |
| `audit` — append-only `audit_event` | |
| `tokens` — hash/verify capability tokens | |
| `share` — share links, `toPublic*` contract, headers | |
| `rate-limit` — Postgres limiter | |
| `cron` — constant-time bearer check | |
| `headers` — global security headers | |

---

## 5. Folder layout

Single Next app, no monorepo (GW and UCS show it is enough; avoids the Vercel root-anchoring trap).

```
saas-foundation/
├─ src/
│  ├─ proxy.ts                      # optimistic auth redirect + headers only; never the authority
│  ├─ app/
│  │  ├─ (public)/                  # landing, /login, /login/verify (POST-to-spend interstitial)
│  │  ├─ o/[org]/                   # everything org-scoped; layout calls requireOrg()
│  │  │  └─ settings/{members,billing}/
│  │  ├─ s/[token]/page.tsx         # public share read (force-dynamic)
│  │  └─ api/
│  │     ├─ auth/[...nextauth]/route.ts
│  │     ├─ cron/route.ts
│  │     └─ webhooks/stripe/route.ts        # billing module
│  ├─ core/
│  │  ├─ env.ts  clock.ts  headers.ts  cron.ts  rate-limit.ts  tokens.ts  audit.ts  email.ts
│  │  ├─ db/{index.ts, schema.ts, local-guard.ts}
│  │  ├─ auth/{config.ts, index.ts}
│  │  ├─ authz/{permissions.ts, guards.ts}
│  │  ├─ tenancy/{orgs.ts, invites.ts}
│  │  └─ share/{links.ts, project.ts}
│  └─ modules/
│     ├─ billing/{schema.ts, provider.ts, stripe.ts, mock.ts, webhook.ts}
│     └─ notifications/{schema.ts, outbox.ts, sms.ts}
├─ drizzle/                          # generated migrations (+ one hand-written: audit trigger)
├─ tests/                            # vitest: unit + integration (local Postgres)
│  └─ invariants/                    # one file per INV-xx
├─ e2e/                              # playwright, production build
├─ scripts/{seed.ts, drain-outbox.ts}
├─ drizzle.config.ts  next.config.ts  vercel.json  .env.example  .env.test
```

---

## 6. Drizzle base schema

`drizzle.config.ts` and `drizzle()` both set `casing: 'snake_case'`, so TS keys are camelCase and columns are
snake_case without per-column names. Auth tables follow `@auth/drizzle-adapter`'s expected shape (text user id,
as UCS already runs in production-like use). Compatibility of `casing` with the adapter is **UNVERIFIED — spike first.**

```ts
// src/core/db/schema.ts
import { pgTable, pgEnum, text, uuid, timestamp, integer, jsonb, bigint,
         primaryKey, index } from 'drizzle-orm/pg-core'

const tstz = () => timestamp({ withTimezone: true, mode: 'date' })
export const timestamps = {
  createdAt: tstz().notNull().defaultNow(),
  updatedAt: tstz().notNull().defaultNow().$onUpdate(() => new Date()),
}

/* ---- Auth.js (adapter-owned shape) ---- */
export const users = pgTable('user', {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text(),
  email: text().notNull().unique(),
  emailVerified: tstz(),
  image: text(),
})
export const accounts = pgTable('account', {
  userId: text().notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text().notNull(),
  provider: text().notNull(),
  providerAccountId: text().notNull(),
  refresh_token: text(), access_token: text(), expires_at: integer(),
  token_type: text(), scope: text(), id_token: text(), session_state: text(),
}, t => [primaryKey({ columns: [t.provider, t.providerAccountId] })])
export const sessions = pgTable('session', {
  sessionToken: text().primaryKey(),
  userId: text().notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: tstz().notNull(),
}, t => [index().on(t.userId)])
export const verificationTokens = pgTable('verification_token', {
  identifier: text().notNull(),
  token: text().notNull(),                       // Auth.js stores a hash
  expires: tstz().notNull(),
}, t => [primaryKey({ columns: [t.identifier, t.token] })])

/* ---- Tenancy ---- */
export const role = pgEnum('role', ['owner', 'admin', 'member'])
export const orgs = pgTable('org', {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  ...timestamps,
})
export const memberships = pgTable('membership', {
  orgId: uuid().notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  userId: text().notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: role().notNull().default('member'),
  ...timestamps,
}, t => [primaryKey({ columns: [t.orgId, t.userId] }), index().on(t.userId)])
export const invites = pgTable('invite', {
  id: uuid().primaryKey().defaultRandom(),
  orgId: uuid().notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  email: text().notNull(),
  role: role().notNull().default('member'),
  tokenHash: text().notNull().unique(),
  invitedBy: text().references(() => users.id, { onDelete: 'set null' }),
  expiresAt: tstz().notNull(),
  acceptedAt: tstz(),
  revokedAt: tstz(),
  createdAt: tstz().notNull().defaultNow(),
})

/* ---- Security primitives ---- */
export const shareLinks = pgTable('share_link', {
  id: uuid().primaryKey().defaultRandom(),
  orgId: uuid().notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  resourceType: text().notNull(),
  resourceId: uuid().notNull(),
  tokenHash: text().notNull().unique(),          // sha256(token); raw token never stored
  createdBy: text().references(() => users.id, { onDelete: 'set null' }),
  expiresAt: tstz().notNull(),                   // required; no immortal links
  revokedAt: tstz(),
  createdAt: tstz().notNull().defaultNow(),
}, t => [index().on(t.orgId, t.resourceType, t.resourceId)])

export const rateLimits = pgTable('rate_limit', {
  key: text().notNull(),                         // e.g. "magic:ip:1.2.3.4"
  windowStart: tstz().notNull(),
  count: integer().notNull().default(0),
}, t => [primaryKey({ columns: [t.key, t.windowStart] })])

export const auditEvents = pgTable('audit_event', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  orgId: uuid().references(() => orgs.id, { onDelete: 'set null' }),
  actorUserId: text(),                           // no FK: survives user deletion
  action: text().notNull(),                      // "member.role_changed"
  targetType: text(),
  targetId: text(),
  data: jsonb(),
  at: tstz().notNull().defaultNow(),
}, t => [index().on(t.orgId, t.at)])
// drizzle/NNNN_audit_append_only.sql (hand-written):
//   CREATE FUNCTION audit_event_immutable() RETURNS trigger AS $$
//   BEGIN RAISE EXCEPTION 'audit_event is append-only'; END $$ LANGUAGE plpgsql;
//   CREATE TRIGGER audit_event_no_update BEFORE UPDATE OR DELETE ON audit_event
//     FOR EACH ROW EXECUTE FUNCTION audit_event_immutable();
```

```ts
// src/modules/billing/schema.ts
export const billingAccounts = pgTable('billing_account', {
  orgId: uuid().primaryKey().references(() => orgs.id, { onDelete: 'cascade' }),
  stripeCustomerId: text().unique(),
  plan: text(),
  status: text(),                                // mirrors Stripe subscription.status
  currentPeriodEnd: tstz(),
  ...timestamps,
})
export const stripeEvents = pgTable('stripe_event', {
  id: text().primaryKey(),                       // evt_…
  type: text().notNull(),
  payload: jsonb().notNull(),
  receivedAt: tstz().notNull().defaultNow(),
  processedAt: tstz(),                           // NULL ⇒ must be re-applied on redelivery
  error: text(),
})

// src/modules/notifications/schema.ts
export const outbox = pgTable('outbox', {
  id: uuid().primaryKey().defaultRandom(),
  orgId: uuid().references(() => orgs.id, { onDelete: 'cascade' }),
  channel: text().notNull(),                     // email | sms
  to: text().notNull(),
  template: text().notNull(),
  data: jsonb().notNull(),
  sendAfter: tstz().notNull().defaultNow(),
  sentAt: tstz(),
  attempts: integer().notNull().default(0),
  lastError: text(),
}, t => [index().on(t.sentAt, t.sendAfter)])
```

**Conventions every app table follows:** `id uuid defaultRandom`, `orgId uuid notNull` FK with cascade (if
org-owned), `...timestamps`, money as `integer` named `*Cents`, enums as `pgEnum`, no soft delete unless a
feature needs it.

---

## 7. Auth and authz contracts

### 7a. Authentication

```ts
// src/core/auth/config.ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, { usersTable: users, accountsTable: accounts,
    sessionsTable: sessions, verificationTokensTable: verificationTokens }),
  session: { strategy: 'database', maxAge: 30 * 86400, updateAge: 86400 },
  providers: [Resend({ from: env.EMAIL_FROM, sendVerificationRequest }), Google],
  pages: { signIn: '/login', verifyRequest: '/login/check-email' },
})
```

- **No Credentials provider in core.** Auth.js forces JWT sessions with Credentials, which loses
  revocation-by-delete (the SB tenant-session gap). Passwords + TOTP are out of scope (§10).
- **Magic links are spent by POST, not GET.** `sendVerificationRequest` emails a link to `/login/verify?u=<callbackUrl>`,
  a page with one button that submits to the Auth.js callback. Scanners that GET the email link spend nothing.
  (GW pattern; wiring through Auth.js is **UNVERIFIED — spike**.)
- Magic-link requests are rate-limited per IP and per email (INV-09); the response is identical whether or not
  the account exists.
- **Revocation:** sign-out-everywhere, membership removal and email change delete `session` rows for that user.

### 7b. Authorization

```ts
// src/core/authz/permissions.ts — pure, no I/O
export type Role = 'owner' | 'admin' | 'member'
export type Permission =
  | 'org.update' | 'org.delete' | 'members.manage' | 'billing.manage'
  | 'share.create' | 'share.revoke' | 'audit.read'
const grants: Record<Role, readonly Permission[]> = {
  owner:  ['org.update','org.delete','members.manage','billing.manage','share.create','share.revoke','audit.read'],
  admin:  ['org.update','members.manage','share.create','share.revoke','audit.read'],
  member: ['share.create'],
}
export const can = (role: Role, p: Permission) => grants[role].includes(p)
```

```ts
// src/core/authz/guards.ts
export type OrgCtx = { userId: string; orgId: string; role: Role }

requireUser(): Promise<{ userId: string; email: string }>        // redirect('/login') if no session
requireOrg(orgSlug: string, perm?: Permission): Promise<OrgCtx>  // loads membership from DB every call
  //  not a member            → notFound()      ("not yours" ≡ "not found", GW pattern)
  //  member without `perm`   → throws AuthzError (403 / form error state)
inOrg(table: { orgId: AnyPgColumn }, ctx: OrgCtx): SQL           // eq(table.orgId, ctx.orgId)
```

**The four rules every handler follows** (each is an invariant in §8):

1. **Guard first.** The first statement of every page, server action and route handler that touches org data is
   `requireOrg(...)` (or `requireUser()`). No reads before the guard, including "confirm" echoes.
2. **Every query on an org-owned table includes `inOrg(t, ctx)`**, reads *and* writes. A write that matched
   zero rows is `notFound()`.
3. **Every secondary id in a request is resolved through `inOrg` too** (the attached member, the linked record).
4. **Every `'use server'` export is a public endpoint.** No helper functions live in `'use server'` files.

```ts
'use server'
export async function renameProject(orgSlug: string, form: FormData) {
  const ctx = await requireOrg(orgSlug, 'org.update')                      // rule 1
  const id = z.string().uuid().parse(form.get('id'))
  const [row] = await db.update(projects).set({ name: String(form.get('name')) })
    .where(and(inOrg(projects, ctx), eq(projects.id, id)))                 // rule 2
    .returning({ id: projects.id })
  if (!row) notFound()
  await audit(ctx, 'project.renamed', { targetType: 'project', targetId: id })
}
```

**Org lifecycle rules:** an org always has ≥1 owner (last owner cannot leave, be demoted or deleted); invites are
hashed tokens with a 7-day expiry, single-use, email-matched on accept; every membership/role change writes an
audit event.

### 7c. Public share contract

```ts
// every shareable resource exports exactly one projection, built on an empty default:
export function toPublicX(row: X): PublicX { return { ...blankPublicX(), title: row.title, /* opt-in only */ } }
```

- Route `/s/[token]`: `sha256(token)` → `share_link` where `revokedAt IS NULL AND expiresAt > now()` → load the
  resource **by `orgId` + `resourceId` from the link row** → `toPublicX()` → render. Unknown, expired and revoked
  all return the same 404.
- Headers on `/s/:path*`: `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`,
  `Cache-Control: private, no-store, max-age=0`; page is `force-dynamic`.
- Token: 32 random bytes, base64url, shown once at creation.
- Read path is rate-limited per IP (Postgres limiter).

---

## 8. Security baseline — testable invariants

Each invariant is one file in `tests/invariants/` (vitest against local Postgres) or `e2e/` where a browser is needed.
The gate is: all pass. Origin column = the real gap it prevents.

| ID | Invariant | How it is tested | Origin |
|---|---|---|---|
| INV-01 | Every export of every `'use server'` module rejects an anonymous caller. | Glob `src/**/*.ts` for `'use server'`, import each module, call every export with no session → expect redirect/throw, zero DB writes. | RB unguarded exports |
| INV-02 | A member of org A cannot read or mutate any org-B row by id. | Two-org fixture; table-driven over every action and `[id]` route with B's ids as A's user → `notFound`, B's rows unchanged. | BK IDORs |
| INV-03 | Secondary ids from another org are rejected. | Same harness; per action, swap each secondary id to org B's. | RB `addLeaseTenant` |
| INV-04 | No handler reads target data before its guard. | Spy on `db`: in INV-02 runs, assert zero selects against the target table before `requireOrg` resolves. | SB rate-change echo |
| INV-05 | Removing a membership or signing out everywhere takes effect on the next request. | Remove membership → next action with the old cookie → `notFound`; sign-out-all → `session` rows gone. | SB tenant JWT |
| INV-06 | Changing a user's email revokes their sessions and pending invites to the old address. | Integration test. | GW portal sessions |
| INV-07 | No raw capability token is stored. | After creating invite / share link / verification token, scan those tables for the raw token string → absent. | UCS raw share token |
| INV-08 | Share links: expiry required; revoke is immediate; headers present; projection is allowlisted. | Insert without `expiresAt` fails (NOT NULL); revoke then GET → 404; header assertions; snapshot `Object.keys(toPublicX(fullRow))` and add a dummy field to the fixture → keys unchanged. | UCS no expiry; CT no revoke |
| INV-09 | Every unauthenticated write (magic-link request, invite accept, share read, public forms) is rate-limited in Postgres. | Burst N+1 requests → last one refused; limiter state survives a fresh module instance (not in memory). | SB checkout lock, BK booking, UCS intake, CT passcode |
| INV-10 | All secret comparisons are constant-time. | Lint rule: no `===`/`!==` against `env.*SECRET*`/`*_KEY`; unit test `cron.authorize`. | BK, UCS cron/intake |
| INV-11 | Every secret-gated endpoint fails closed when its secret is unset. | Unset each (cron, webhook) → 401/404, never 200. | UCS intake open |
| INV-12 | Webhooks verify the raw body with a timestamp window; a delivery whose earlier attempt failed is re-applied; a true duplicate is a no-op. | Bad sig → 400; stale timestamp → 400; first apply throws → redelivery applies (processedAt set); third delivery → no side effect. | SB webhook retry; RB Resend replay |
| INV-13 | In production, a missing email/SMS provider throws; message bodies are never logged when `VERCEL_ENV=production`. | Unit test on transport with env stubbed. | GW token in logs |
| INV-14 | The app refuses to boot with a missing required env var, and `.env.example` names exactly the schema's keys. | Unit test parses `.env.example` vs zod schema keys. | UCS `.env.example` drift |
| INV-15 | Every response carries the global headers: `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: frame-ancestors 'none'`, `Strict-Transport-Security`. | e2e request to a public, an authed and a share route. | CT/SB/GW/RB missing headers |
| INV-16 | No secret is accepted from a query string. | Grep test: no `searchParams.get(` compared with an env secret. | RB inbound `?secret=` |
| INV-17 | A GET of the emailed login URL does not spend the token. | e2e: GET link twice, then click → signs in. | SB magic link on GET |
| INV-18 | Tests and destructive scripts refuse non-local database URLs. | Unit test on `local-guard` with a `*.neon.tech` URL → throws. | UCS Neon-branch tests |
| INV-19 | `audit_event` rejects UPDATE and DELETE. | Integration test expects the trigger exception. | BX P0-2 |
| INV-20 | No `NEXT_PUBLIC_*` variable is a secret. | Allowlist test over `process.env` keys in `env.ts`. | preventive |
| INV-21 | An org cannot reach zero owners. | Demote/remove/leave the sole owner → refused. | GW last dispatcher |

Project hygiene (from `~/.claude/CLAUDE.md`, not repeated here): own port from the table, `ignoreCommand`
copied from RB, local `DATABASE_URL` with `?connection_limit=10&pool_timeout=20`, `swapcheck` pre-hooks,
prod-build e2e, CI with a Postgres service container.

---

## 9. Migration path per repo

**Stance: the foundation is for new projects and UCS. The five Prisma repos adopt the security baseline in
place; they are not ported to Drizzle.** A port rewrites every query in 97–111-model schemas with 114–124
migrations (SB, RB) for no user-visible gain, and the gaps in §3 are ORM-independent. Revisit per repo only if it
sees sustained new development.

| Repo | Path | Effort | Steps (in order) |
|---|---|---|---|
| **BX** Boxloop | **Greenfield — first clone of the foundation.** | n/a | Clone; add `plan`, `subscription`, `invoice` tables in its own schema file; state machine + proration as pure modules on `core/clock`; billing module's `PaymentProvider` mock is exactly PRD P2's "swap in one file". |
| **UCS** Use-Case Studio | **Converge onto the foundation** (already Drizzle + Auth.js). | M | 1. Next 15→16 (`middleware.ts`→`proxy.ts`). 2. `share_link`: add `token_hash`, `expires_at`, `revoked_at`, `org_id`; backfill hashes, drop raw token. 3. Replace in-memory limiter with `rate_limit` table. 4. `env.ts`; make intake fail closed; constant-time compares. 5. Personal org per user, backfill `org_id`, swap `owned()` → `inOrg()`. 6. Integration tests to local Postgres. 7. `ignoreCommand`; move off :3000 (collides with storage). |
| **BK** Bookable | Baseline in place. | M | 1. **Scope every write by `businessId`** (list in §3a) — must land before any second business. 2. INV-01/02 harness adapted to Prisma. 3. Rate-limit public booking with the existing `consumeRateLimit`. 4. Constant-time cron. 5. `ignoreCommand`. |
| **SB** storage | Baseline in place. | M | 1. Webhook: re-apply when `processedAt` null. 2. Move rate-change echo after `assertFacilityAccess`. 3. Tenant session watermark (copy RB `sessionsValidFrom`). 4. Rate-limit public checkout + magic-link/reset requests. 5. Global headers. 6. POST-to-spend magic link. 7. `ignoreCommand`. |
| **RB** rental | Baseline in place (it is the source of several foundation patterns). | S | 1. Guard or move out `markNoticeRead`, prospect/showing invites, `propertyForTenant`. 2. Scope `tenantId` in `addLeaseTenant`. 3. Use write-permission scope in deposit/expense/vendor-invoice actions. 4. Resend timestamp window; drop `?secret=`. 5. Referrer-Policy; `no-store` on private document bytes. |
| **GW** groundwork | Baseline in place; smallest Prisma repo (11 migrations) — the only port candidate if it stays active. | S | 1. Delete portal sessions on property contact change. 2. Console provider throws in production. 3. Global headers. 4. Per-IP limit on link requests; last-dispatcher guard. 5. Reschedule in one transaction. |
| **CT** Countertop | Baseline in place. | S | 1. Rate-limit passcode. 2. `requireStaff()` inside kitchen actions (defense in depth). 3. Status token: hash + expiry + Referrer-Policy. 4. Real SMS verification before any deploy. 5. `ignoreCommand`. |

---

## 10. Out of scope for v1

- **Passwords, TOTP/MFA, recovery codes** — RB/SB have good implementations; add as a module later (forces JWT + watermark).
- Impersonation / support "act as" (SB proxy method-block pattern noted for later).
- **Postgres RLS** as a second isolation layer — see open question 1.
- SSO/SAML, SCIM, per-org custom domains.
- File uploads / blob storage (GW's magic-byte + `PhotoStore` seam is the reference when needed).
- Soft delete, data retention sweeps (CT has one).
- Subscription domain logic (state machine, proration, dunning) — that is Boxloop's product, not the foundation's.
- AI spend guards (UCS `lib/kickoff/limits.ts` — reference only).
- Redis or any non-Postgres infrastructure.
- Porting the five Prisma repos to Drizzle (§9).

---

## 11. Open decisions for approval

1. **RLS or app-only isolation?** Recommendation: app-only `inOrg` + INV-02 harness for v1; RLS needs a
   per-request `set_config` inside a transaction, which the Neon HTTP driver cannot do.
2. **Driver:** `pg` (node-postgres) against Neon's pooled URL everywhere, so local tests and production use one
   driver. Recommendation: yes; `@neondatabase/serverless` only if an edge runtime is ever required.
3. **Active org in the URL (`/o/[org]/…`) vs a cookie.** Recommendation: URL — every request names its org and is
   membership-checked; no stale-cookie class of bugs.
4. **Ports:** claim **4100** for the foundation template itself, and give UCS **4200** when it moves off :3000.
   Each clone takes the next free hundred at creation.
5. **Repo:** private GitHub repo `saas-foundation`, created when the first code lands (post-approval).

Spikes before code: Drizzle `casing` × Auth.js adapter (§6); POST-to-spend interstitial through Auth.js (§7a).
