import { beforeEach, describe, expect, it } from 'vitest';
import { deleteListing } from '@/app/o/[org]/listings/actions';
import { db } from '@/core/db';
import { searchableListings } from '@/lib/tenancy';
import { JOB, LISTING } from '../fixtures/app';
import { resetAuthTables } from '../helpers/auth';
import { NavSignal } from '../helpers/next';
import { actAs, addMember, makeOrg } from '../helpers/org';

// P0-2: the public read path, the database's range checks, and a listing with jobs outliving a delete.
beforeEach(resetAuthTables);

const outcome = (e: unknown) => (e instanceof NavSignal ? e.kind : e);

describe('searchableListings', () => {
  it('narrows by category and weekday across providers, and carries each provider rating', async () => {
    const [p, q] = [await makeOrg('p'), await makeOrg('q')];
    await db.providerRating.create({ data: { orgId: q.id, count: 2, sum: 9 } });
    await db.listing.createMany({
      data: [
        { ...LISTING, orgId: p.id, title: 'P weekdays' },
        { ...LISTING, orgId: q.id, title: 'Q saturdays', days: [6] },
        { ...LISTING, orgId: q.id, title: 'Q painting', category: 'painting' },
      ],
    });
    const found = await searchableListings({ category: 'plumbing', weekday: 1 });
    expect(found.map((l) => l.title)).toEqual(['P weekdays']);
    expect(found[0]!.org).toEqual({ name: 'p', rating: null });
    const sat = await searchableListings({ category: 'plumbing', weekday: 6 });
    expect(sat.map((l) => [l.title, l.org.rating])).toEqual([['Q saturdays', { count: 2, sum: 9 }]]);
  });

  it('the database refuses out-of-range money, areas, days and ratings', async () => {
    const p = await makeOrg('p');
    for (const bad of [{ rateCents: 0 }, { radiusMiles: 0 }, { lat: 91 }, { days: [7] }]) {
      await expect(db.listing.create({ data: { ...LISTING, orgId: p.id, title: 'x', ...bad } })).rejects.toThrow();
    }
    await expect(db.providerRating.create({ data: { orgId: p.id, count: 1, sum: 6 } })).rejects.toThrow();
  });
});

describe('deleteListing', () => {
  it('refuses a listing that has jobs, and deletes one that has none', async () => {
    const p = await makeOrg('p');
    const u = await addMember(p.id, 'owner', 'u@example.test');
    const c = await db.user.create({ data: { email: 'c@example.test' } });
    const [busy, idle] = await Promise.all(['busy', 'idle'].map((title) => db.listing.create({ data: { ...LISTING, orgId: p.id, title } })));
    await db.job.create({ data: { ...JOB, orgId: p.id, listingId: busy!.id, clientId: c.id } });
    await actAs(u.id, 'p');

    expect(await deleteListing('p', { id: busy!.id })).toEqual({ error: 'This listing has jobs, so it cannot be deleted.' });
    expect(await deleteListing('p', { id: idle!.id }).catch(outcome)).toBe('redirect');
    expect((await db.listing.findMany()).map((l) => l.title)).toEqual(['busy']);
  });
});
