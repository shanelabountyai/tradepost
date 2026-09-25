# Decisions

## D-001 — Built on SaaS foundation; provider = org (2026-09-25)

**Chose:** clone `saas-foundation` v1.0.1 as its first clone. Each provider business is an org, so the PRD's `provider_id` is the `orgId`.
Clients are plain users with no org. A dual-role user is a client and also a member of their own provider org.

**Why:** auth (magic link + TOTP), the append-only audit log, cron, the injected clock and the mock payment provider are
already built and invariant-tested. Mapping provider to org reuses the foundation's not-found-on-foreign-row guard (`requireOrg`)
and the INV-01..04 harness, so neither is re-derived.

**Rejected:** a standalone app (it rebuilds solved auth and audit), and clone with a separate `Provider` table
(it carries unused org machinery alongside a second tenant key).

**Consequence:** the PRD asks for a scoping layer that *injects* the tenant filter. The template's convention is to
*spread* `inOrg(ctx)` by hand, so this clone adds a scoped client for provider-owned models (P0-1) and a lint test
against raw access. Client-side reads (search, a client's own bookings) are scoped by `clientId`. They are a
second axis, and they must not share the provider path (the PRD's dual-role bleed test).

## D-002 — P0-1 tenancy layer build choices (2026-09-25)

**Chose:** `src/lib/tenancy.ts` exposes `providerDb(ctx)` (listing, job; `orgId`) and `clientDb(session)` (job; `clientId`),
each a Prisma query extension that ANDs the tenant key into every `where`, stamps it on every `create`, and throws on an
update that names a tenant key (`orgId`/`org`/`clientId`/`client`), so rows never move between tenants. A foreign id
reads as `null` or P2025, and callers map that to `notFound` with the template's `notFoundOnP2025`.
`Job → Listing` is a composite FK on `(listingId, orgId)`, so the database refuses a job whose listing belongs to another
provider. `Job.clientId` is `onDelete: Restrict`: money rows never disappear with an account.
`tests/unit/tenancy-lint.test.ts` scans `src/` for `db|tx|prisma.<model>` and quoted raw table names outside the layer.
It carries its own negative control. Tests and seed scripts are exempt on purpose.

**Why:** the PRD asks for injection rather than a spread by hand, and an extension gives that in about 30 lines, with no
wrapper function per query. A mutation check (filter disabled) turns 4 of the 6 integration tests red. The other two
guard the immutability check and the FK, which do not depend on the filter.

**Known ceiling:** only top-level queries are rescoped. A nested `include` or a nested write through another model is
not. That is marked `ponytail:` in the layer.

**Upstream note:** `prisma migrate dev` re-adds Prisma's two-line header to `migration_lock.toml`, and that trips
`foundation:drift`. It was reverted here. The template should ship the header.

## D-003 — P0-2 listings & search build choices (2026-09-25)

**Chose:**
- **Listing fields.** `category` is a Prisma enum (one level, PRD non-goal). The service area is `lat`/`lng` + `radiusMiles`.
  `rateCents` is an integer, and the form takes whole dollars. `days Int[]` holds the weekly pattern (0 = Sunday). A
  separate migration adds database CHECKs for the rate, radius, coordinates, days and the rating range.
- **Rating lives in `ProviderRating`** (orgId PK, `count`, `sum` of stars), not in columns on the template's `Org`. The
  mean is computed as `sum / count`, so no stored float can drift. P0-3 writes it on publication.
- **Search splits in two.** `searchableListings` in `src/lib/tenancy.ts` is the one un-tenanted, read-only, field-selected
  read, and it narrows by category and weekday in SQL. `rankListings` in `src/lib/search.ts` is pure: it filters on
  haversine distance ≤ the listing's own radius and on min rating, then orders by mean desc, count desc, distance asc.
  Unrated scores 0. A calendar date's weekday is read in UTC.
- **`Job → Listing` is now `NoAction`.** A listing with jobs refuses deletion (`Refused`), so money rows never cascade
  away. An org delete still cascades both, because NO ACTION is checked at the end of the statement.
- **`/search` is a public GET form**, so a search is a URL. Weekdays post as checkboxes `d0`–`d6`, because the action
  layer's `Object.fromEntries(FormData)` keeps only the last value of a repeated name.

**Found:** `seedApp` (P0-1) returned random ids, but the harness reseeds before every call and generates each input
only once. Every `ref('listing')` action would therefore have hit a stale id. The fixture ids are now fixed.

**Known ceilings:** the client types coordinates, because there is no geocoder. The distance filter runs in memory after the SQL narrowing, and
a bounding-box `WHERE` is the upgrade if the listing count grows. Availability is by weekday only, because hours arrive with booking.
