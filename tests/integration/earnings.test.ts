import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { providerLedgerTotals } from '@/lib/tenancy';
import { JOB, LISTING } from '../fixtures/app';
import { resetAuthTables } from '../helpers/auth';
import { makeOrg } from '../helpers/org';

// P1 earnings dashboard: sums a provider's own ledger rows by kind, and only that provider's.
beforeEach(resetAuthTables);

async function jobWithLedger(orgId: string, clientId: string, rows: { kind: 'hold' | 'release' | 'fee' | 'refund'; amountCents: number }[]) {
  const listing = await db.listing.create({ data: { ...LISTING, orgId, title: 'x' } });
  const job = await db.job.create({ data: { ...JOB, orgId, listingId: listing.id, clientId } });
  await db.ledgerEntry.createMany({ data: rows.map((r) => ({ ...r, jobId: job.id })) });
  return job.id;
}

describe('providerLedgerTotals', () => {
  it('nets held to what is still in escrow, and never counts another provider’s rows', async () => {
    const [p, q] = [await makeOrg('p'), await makeOrg('q')];
    const c = await db.user.create({ data: { email: 'c@example.test' } });
    // p: one job fully released with a fee, one job still held.
    await jobWithLedger(p.id, c.id, [{ kind: 'hold', amountCents: 8500 }, { kind: 'release', amountCents: 7650 }, { kind: 'fee', amountCents: 850 }]);
    await jobWithLedger(p.id, c.id, [{ kind: 'hold', amountCents: 5000 }]);
    // q: a fully refunded job. Must not leak into p's totals (P0-1).
    await jobWithLedger(q.id, c.id, [{ kind: 'hold', amountCents: 3000 }, { kind: 'refund', amountCents: 3000 }]);

    expect(await providerLedgerTotals(p.id)).toEqual({ held: 5000, released: 7650, fees: 850, refunded: 0 });
    expect(await providerLedgerTotals(q.id)).toEqual({ held: 0, released: 0, fees: 0, refunded: 3000 });
  });

  it('is all zero for a provider with no jobs', async () => {
    const p = await makeOrg('p');
    expect(await providerLedgerTotals(p.id)).toEqual({ held: 0, released: 0, fees: 0, refunded: 0 });
  });
});
