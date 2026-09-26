import { db } from '@/core/db';

// The required Listing fields a fixture does not care about: plumbing, weekdays, 10 mi around downtown Austin.
export const LISTING = { category: 'plumbing' as const, lat: 30.2672, lng: -97.7431, radiusMiles: 10, rateCents: 8500, days: [1, 2, 3, 4, 5] };
// The required Job fields: a Monday, at LISTING's rate.
export const JOB = { date: new Date('2026-10-05'), amountCents: 8500 };

// CLONE-OWNED. The INV-01..04 harness seeds these rows in both fixture orgs, so it can drive
// actions whose inputs use ref('<model>') for the clone's own tables. Return { model: id } for
// one row of each model, owned by `org.orgId`. Ids are fixed: the harness reseeds before every call
// but generates each input once, so a random id would be stale by the time the action runs.
export async function seedApp(org: { orgId: string; userId: string }, key: 'a' | 'b'): Promise<Record<string, string>> {
  const id = (n: number) => `00000000-0000-4000-8000-${key === 'a' ? 1 : 2}${String(n).padStart(11, '0')}`;
  const listing = await db.listing.create({ data: { ...LISTING, id: id(50), orgId: org.orgId, title: `Listing ${key}` } });
  // The actor is also the job's client (dual-role), so both the provider's and the client's job actions are drivable.
  const job = await db.job.create({ data: { ...JOB, id: id(51), orgId: org.orgId, listingId: listing.id, clientId: org.userId } });
  return { listing: listing.id, job: job.id };
}
