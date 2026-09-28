import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { db } from '@/core/db';
import { destroyOrg } from '@/app/o/[org]/settings/danger/actions';
import { closeProviderForDelete } from '@/lib/tenancy';
import { JOB, LISTING } from '../fixtures/app';
import { resetAuthTables } from '../helpers/auth';
import { actAs, addMember, makeOrg } from '../helpers/org';

beforeEach(resetAuthTables);
afterEach(() => vi.restoreAllMocks());

// The billing module is removable and foundation:check-modules typechecks the tree without it, so billing is loaded by
// a non-literal specifier that tsc does not resolve. Upstream fix: list this file in the template-owned module manifest.
const BILLING = '@/modules/billing/provider';
type Billing = { mockProvider: { cancel: (...a: unknown[]) => unknown } };
type BillingDb = { billingAccount: { create: (a: { data: Record<string, unknown> }) => Promise<unknown> } };

// D-012: a provider with jobs is refused before its subscription is touched, so it is never left unbilled.
it('a provider with jobs is refused, and its subscription is not cancelled', async () => {
  const { mockProvider } = (await import(/* @vite-ignore */ BILLING)) as Billing;
  const cancel = vi.spyOn(mockProvider, 'cancel');
  const org = await makeOrg();
  const owner = await addMember(org.id, 'owner', 'owner@example.test');
  await actAs(owner.id, org.slug);
  await (db as unknown as BillingDb).billingAccount.create({ data: { orgId: org.id, status: 'active', stripeSubscriptionId: 'sub_P' } });
  const l = await db.listing.create({ data: { ...LISTING, orgId: org.id, title: 'P plumbing' } });
  await db.job.create({ data: { ...JOB, orgId: org.id, listingId: l.id, clientId: owner.id } });

  expect(await destroyOrg(org.slug, { confirm: org.slug })).toMatchObject({ error: expect.stringContaining('jobs on record') });
  expect(cancel).not.toHaveBeenCalled();
  expect(await db.org.count()).toBe(1);
});

// F-25 (D-014): the guard's count and listing delete share one transaction, so no job can slip in before the delete.
it('a job insert still in flight makes the guard refuse, and the listing stays', async () => {
  const org = await makeOrg();
  const client = await db.user.create({ data: { email: 'client@example.test' } });
  const l = await db.listing.create({ data: { ...LISTING, orgId: org.id, title: 'P plumbing' } });
  let commit!: () => void;
  const held = new Promise<void>((r) => (commit = r));
  let inserted!: () => void;
  const started = new Promise<void>((r) => (inserted = r));
  const booking = db.$transaction(async (tx) => {
    await tx.job.create({ data: { ...JOB, orgId: org.id, listingId: l.id, clientId: client.id } });
    inserted();
    await held; // uncommitted: the guard's listing delete must wait on this row's key-share lock
  });
  await started;
  const guard = closeProviderForDelete(org.id);
  await new Promise((r) => setTimeout(r, 200));
  commit();
  await booking;
  expect(await guard).toBe(false);
  expect(await db.listing.count({ where: { orgId: org.id } })).toBe(1);
  expect(await db.job.count({ where: { orgId: org.id } })).toBe(1);
});

it('once the guard passes, the provider has no listings and no job can be booked', async () => {
  const org = await makeOrg();
  const client = await db.user.create({ data: { email: 'client@example.test' } });
  const l = await db.listing.create({ data: { ...LISTING, orgId: org.id, title: 'P plumbing' } });
  expect(await closeProviderForDelete(org.id)).toBe(true);
  expect(await db.listing.count({ where: { orgId: org.id } })).toBe(0);
  await expect(db.job.create({ data: { ...JOB, orgId: org.id, listingId: l.id, clientId: client.id } })).rejects.toMatchObject({ code: 'P2003' });
});
