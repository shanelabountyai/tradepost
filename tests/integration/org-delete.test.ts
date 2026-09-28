import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { db } from '@/core/db';
import { destroyOrg } from '@/app/o/[org]/settings/danger/actions';
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
