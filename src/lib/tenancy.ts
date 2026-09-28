import type { SessionCtx } from '@/core/auth/session';
import type { OrgCtx } from '@/core/authz/guards';
import { notFound } from 'next/navigation';
import { now } from '@/core/clock';
import { db } from '@/core/db';
import type { Prisma } from '@/generated/prisma/client';
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
 * F-25 (D-014): the org-delete guard. One transaction refuses a provider with any job, then deletes its listings.
 * Every job needs a listing, so once this commits no job (and so no message, review or ledger row) can appear
 * before core `deleteOrg` runs. A job insert still in flight holds a key-share lock on its listing: the listing
 * delete waits for it, then fails on the foreign key (P2003) and rolls back. Returns false when refused.
 */
export async function closeProviderForDelete(orgId: string): Promise<boolean> {
  const x = db.$extends({ query: { listing: tenantFilter({ orgId }), job: tenantFilter({ orgId }) } });
  return x
    .$transaction(async (tx) => {
      if (await tx.job.count()) return false;
      await tx.listing.deleteMany({});
      return true;
    })
    .catch((e) => {
      if (e?.code === 'P2003') return false;
      throw e;
    });
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

/**
 * Admin (P0-6): runs `fn` in one transaction with a job client scoped to the job's own provider, so a
 * dispute resolution's ledger rows and its audit row commit together. Callers pass requirePlatformAdmin first.
 */
export async function inProviderTx<T>(
  jobId: string,
  fn: (jobs: ReturnType<typeof providerDb>['job'], tx: Prisma.TransactionClient, orgId: string) => Promise<T>,
) {
  const j = await db.job.findUnique({ where: { id: jobId }, select: { orgId: true } });
  if (!j) notFound();
  const x = db.$extends({ query: { job: tenantFilter({ orgId: j.orgId }) } });
  return x.$transaction((tx) => fn(tx.job as unknown as ReturnType<typeof providerDb>['job'], tx as unknown as Prisma.TransactionClient, j.orgId));
}

/** Admin (P0-6): every open dispute across providers, with both statements. Callers pass requirePlatformAdmin first. */
export function openDisputes() {
  return db.job.findMany({
    where: { status: 'disputed' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, date: true, amountCents: true,
      org: { select: { name: true } }, client: { select: { email: true } }, listing: { select: { title: true } }, dispute: true,
    },
  });
}

/** Admin (D-009, F-05): resolved disputes, newest first. No statements: those are read, audited, on the case page. */
export function resolvedDisputes() {
  return db.dispute.findMany({
    where: { resolvedAt: { not: null } },
    orderBy: { resolvedAt: 'desc' },
    select: {
      jobId: true, resolvedAt: true, refundCents: true,
      job: { select: { date: true, amountCents: true, org: { select: { name: true } }, client: { select: { email: true } }, listing: { select: { title: true } } } },
    },
  });
}

/**
 * P0-5, the one include that reads reviews: a party sees its own review, and the other's only once
 * published. Spread it into a scoped job query: `include: { ...reviewsVisibleTo('client') }`.
 */
export const reviewsVisibleTo = (party: 'client' | 'provider') => ({
  reviews: { where: { OR: [{ by: party }, { publishedAt: { not: null } }] }, select: { by: true, stars: true, body: true, publishedAt: true } },
});

/**
 * System (P0-5): publishes a job's unpublished reviews, and adds a newly published client review's stars
 * to its provider's rating. The `publishedAt: null` guard makes that happen once, however many callers race.
 * `onlyIfBoth`: the submit path, which publishes only once both parties have reviewed.
 */
export function publishReviews(jobId: string, onlyIfBoth: boolean) {
  return db.$transaction(async (tx) => {
    const job = await tx.job.findUniqueOrThrow({ where: { id: jobId }, select: { orgId: true, reviews: { select: { by: true, stars: true } } } });
    if (onlyIfBoth && job.reviews.length < 2) return;
    const at = now();
    const client = await tx.review.updateMany({ where: { jobId, by: 'client', publishedAt: null }, data: { publishedAt: at } });
    await tx.review.updateMany({ where: { jobId, by: 'provider', publishedAt: null }, data: { publishedAt: at } });
    const stars = job.reviews.find((r) => r.by === 'client')?.stars;
    if (client.count && stars) {
      await tx.providerRating.upsert({
        where: { orgId: job.orgId },
        create: { orgId: job.orgId, count: 1, sum: stars },
        update: { count: { increment: 1 }, sum: { increment: stars } },
      });
    }
  });
}

/** System (cron, P0-5): closed jobs whose review window ended with a review still unpublished. */
export function reviewsDue(closedBefore: Date) {
  return db.job.findMany({ where: { closedAt: { lte: closedBefore }, reviews: { some: { publishedAt: null } } }, select: { id: true } });
}
