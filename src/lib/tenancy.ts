import type { SessionCtx } from '@/core/auth/session';
import type { OrgCtx } from '@/core/authz/guards';
import { db } from '@/core/db';

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
 * A client's own jobs: every query is `clientId = s.userId`. A separate path from providerDb, so a
 * dual-role user's two views never share a filter (PRD P0-1).
 */
export function clientDb(s: Pick<SessionCtx, 'userId'>) {
  const x = db.$extends({ query: { job: tenantFilter({ clientId: s.userId }) } });
  return { job: x.job };
}
