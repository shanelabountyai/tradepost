import type { SessionCtx } from '@/core/auth/session';
import type { OrgCtx } from '@/core/authz/guards';
import { db } from '@/core/db';
import type { ServiceCategory } from '@/generated/prisma/enums';

// P0-1 (D-001): the only door to provider-owned tables. Every query through these clients has its
// tenant filter injected: `where` gets it ANDed in, `create` gets it stamped on, and an update that
// tries to move a row between tenants throws. A foreign id therefore reads as null / P2025, which
// the caller turns into notFound (`notFoundOnP2025`), never 403. tests/unit/tenancy-lint.test.ts
// fails the build on any `db.listing` / `db.job` / raw SQL on these tables outside this file.
//
// ponytail: filters top-level queries only. A nested `include`/`select` of a relation, or a nested
// write through another model, is not rescoped; keep relation reads pointing at the caller's own
// rows (job → listing, job → org) and add a rescope here if a query ever needs to walk outward.

type Op = { operation: string; args: Record<string, unknown>; query: (args: unknown) => Promise<unknown> };

const TENANT_KEYS = ['orgId', 'org', 'clientId', 'client'];

function tenantFilter(filter: Record<string, string>) {
  return {
    async $allOperations({ operation, args, query }: Op) {
      const a = { ...args };
      if (operation.startsWith('update') || operation === 'upsert') {
        for (const data of [a.data, a.update]) {
          if (data && TENANT_KEYS.some((k) => k in (data as object))) throw new Error('Tenant keys are immutable after create.');
        }
      }
      if (operation.startsWith('create')) {
        a.data = Array.isArray(a.data) ? a.data.map((d) => ({ ...d, ...filter })) : { ...(a.data as object), ...filter };
      } else {
        a.where = { ...(a.where as object), ...filter };
        if (operation === 'upsert') a.create = { ...(a.create as object), ...filter };
      }
      return query(a);
    },
  };
}

/** A provider's own listings and jobs: every query is `orgId = ctx.orgId`. */
export function providerDb(ctx: Pick<OrgCtx, 'orgId'>) {
  const guard = tenantFilter({ orgId: ctx.orgId });
  const x = db.$extends({ query: { listing: guard, job: guard } });
  return { listing: x.listing, job: x.job };
}

/**
 * Public and read-only: every provider's listings in one category that work on one weekday, with
 * only the fields a client may see. The one un-tenanted read of a provider-owned table (P0-2).
 */
export function searchableListings(q: { category: ServiceCategory; weekday: number }) {
  return db.listing.findMany({
    where: { category: q.category, days: { has: q.weekday } },
    select: {
      id: true, title: true, category: true, description: true, lat: true, lng: true, radiusMiles: true, rateCents: true, days: true,
      org: { select: { name: true, rating: { select: { count: true, sum: true } } } },
    },
  });
}

/**
 * A client's own jobs: every query is `clientId = s.userId`. A separate path from providerDb, so a
 * dual-role user's two views never share a filter (PRD P0-1).
 */
export function clientDb(s: Pick<SessionCtx, 'userId'>) {
  const x = db.$extends({ query: { job: tenantFilter({ clientId: s.userId }) } });
  return { job: x.job };
}

/** Public: what a client needs to book one listing. A listing id is public, like the search result it came from. */
export function bookableListing(id: string) {
  return db.listing.findUnique({ where: { id }, select: { id: true, orgId: true, rateCents: true, days: true } });
}

/**
 * System (cron): completed jobs whose 72h confirmation window has passed, across providers. Read
 * only; each is then moved through providerDb for its own org, so the write path stays scoped.
 */
export function dueForAutoConfirm(cutoff: Date) {
  return db.job.findMany({ where: { status: 'completed', completedAt: { lte: cutoff } }, select: { id: true, orgId: true } });
}
