import { db } from '@/core/db';

// CLONE-OWNED. The INV-01..04 harness seeds these rows in both fixture orgs, so it can drive
// actions whose inputs use ref('<model>') for the clone's own tables. Return { model: id } for
// one row of each model, owned by `org.orgId`.
export async function seedApp(org: { orgId: string; userId: string }, key: 'a' | 'b'): Promise<Record<string, string>> {
  const client = await db.user.create({ data: { email: `client-${key}@example.test` } });
  const listing = await db.listing.create({ data: { orgId: org.orgId, title: `Listing ${key}` } });
  const job = await db.job.create({ data: { orgId: org.orgId, listingId: listing.id, clientId: client.id } });
  return { listing: listing.id, job: job.id };
}
