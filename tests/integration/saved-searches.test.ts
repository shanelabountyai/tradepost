import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteSavedSearch, saveSearch } from '@/app/searches/actions';
import { advanceClock } from '@/core/clock';
import { db } from '@/core/db';
import { drainOutbox } from '@/modules/notifications/outbox';
import { matchNewSavedSearches } from '@/lib/saved-searches';
import { LISTING } from '../fixtures/app';
import { resetAuthTables, signInAs } from '../helpers/auth';
import { NavSignal } from '../helpers/next';

// P1 (F-20): saved searches are userId-owned, matched by a cron pass against new listings.
let n = 0;
const client = () => db.user.create({ data: { email: `c${n++}@example.test` } });
const provider = () => db.org.create({ data: { slug: `p${n++}`, name: 'P' } });
const outcome = (e: unknown) => (e instanceof NavSignal ? e.kind : e);

beforeEach(async () => {
  await resetAuthTables();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('saveSearch / deleteSavedSearch', () => {
  it('a signed-in client saves and removes their own search; a foreign id 404s', async () => {
    const c = await client();
    await signInAs(c.id, { mfa: true });
    const form = new FormData();
    form.set('category', LISTING.category);
    form.set('lat', String(LISTING.lat));
    form.set('lng', String(LISTING.lng));
    form.set('minRating', '0');
    expect(await saveSearch(form).catch(outcome)).toBe('redirect');
    const mine = await db.savedSearch.findFirstOrThrow({ where: { userId: c.id } });

    const other = await client();
    await signInAs(other.id, { mfa: true });
    const del = new FormData();
    del.set('id', mine.id);
    expect(await deleteSavedSearch(del).catch(outcome)).toBe('notFound'); // foreign id, never a leak

    await signInAs(c.id, { mfa: true });
    expect(await deleteSavedSearch(del).catch(outcome)).toBe('redirect');
    expect(await db.savedSearch.findUnique({ where: { id: mine.id } })).toBeNull();
  });
});

describe('matchNewSavedSearches (cron)', () => {
  it('emails once for a new in-range listing, then never again for the same one', async () => {
    const c = await client();
    const p = await provider();
    const search = await db.savedSearch.create({ data: { userId: c.id, category: LISTING.category, lat: LISTING.lat, lng: LISTING.lng } });
    await db.listing.create({ data: { ...LISTING, orgId: p.id, title: 'New plumber' } });

    expect(await matchNewSavedSearches()).toEqual({ checked: 1, notified: 1 });
    expect(await matchNewSavedSearches()).toEqual({ checked: 1, notified: 0 });

    await drainOutbox();
    expect(await db.capturedMessage.findFirst()).toMatchObject({ body: expect.stringContaining('New plumber') });
    expect((await db.savedSearch.findUniqueOrThrow({ where: { id: search.id } })).checkedAt.getTime()).toBeGreaterThan(search.checkedAt.getTime());
  });

  it('skips a listing outside the radius, and one below the minimum rating', async () => {
    const c = await client();
    const p = await provider();
    await db.savedSearch.create({ data: { userId: c.id, category: LISTING.category, lat: LISTING.lat, lng: LISTING.lng, minRating: 4 } });

    await db.listing.create({ data: { ...LISTING, orgId: p.id, radiusMiles: 1, lat: LISTING.lat + 5, title: 'Too far' } });
    await db.listing.create({ data: { ...LISTING, orgId: p.id, title: 'Unrated' } }); // no ProviderRating row: mean 0 < minRating 4
    expect(await matchNewSavedSearches()).toEqual({ checked: 1, notified: 0 });
  });

  it('a search never matches a listing that already existed when it was saved (no backfill blast)', async () => {
    const p = await provider();
    await db.listing.create({ data: { ...LISTING, orgId: p.id, title: 'Old plumber' } });
    advanceClock(60_000);
    const c = await client();
    await db.savedSearch.create({ data: { userId: c.id, category: LISTING.category, lat: LISTING.lat, lng: LISTING.lng } });
    expect(await matchNewSavedSearches()).toEqual({ checked: 1, notified: 0 });
  });
});
