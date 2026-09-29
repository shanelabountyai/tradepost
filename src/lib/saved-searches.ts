import { notFound } from 'next/navigation';
import { now } from '@/core/clock';
import { db } from '@/core/db';
import type { ServiceCategory } from '@/generated/prisma/enums';
import { haversineMiles } from '@/lib/search';
import { listingsSince } from '@/lib/tenancy';
import { notifyClient } from '@/lib/notify';

// P1 (F-20): saved searches are this app's own table, not provider-owned, so they stay outside
// tenancy.ts's MODELS list — every query here is `userId`-scoped by the caller, never a foreign id.

export const listSavedSearches = (userId: string) => db.savedSearch.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });

export const createSavedSearch = (userId: string, i: { category: ServiceCategory; lat: number; lng: number; minRating: number }) =>
  db.savedSearch.create({ data: { userId, ...i } });

/** `where: { id, userId }` on a `delete`: a foreign id throws P2025, same shape as a scoped job (src/lib/tenancy.ts). */
export async function removeSavedSearch(userId: string, id: string) {
  await db.savedSearch.delete({ where: { id, userId } }).catch((e) => {
    if (e?.code === 'P2025') notFound();
    throw e;
  });
}

/**
 * Cron: for each saved search, listings in its category created since the last check, inside its
 * radius and at/above its minimum rating. A match notifies once by email, then `checkedAt` advances
 * to now regardless, so the same listing is never re-checked (a new search starts from its own
 * createdAt, no backfill blast).
 */
export async function matchNewSavedSearches(): Promise<{ checked: number; notified: number }> {
  const at = now();
  const searches = await db.savedSearch.findMany({ include: { user: { select: { email: true } } } });
  let notified = 0;
  for (const s of searches) {
    const listings = await listingsSince(s.category, s.checkedAt);
    const matches = listings.filter((l) => {
      const count = l.org.rating?.count ?? 0;
      const mean = count ? l.org.rating!.sum / count : 0;
      return haversineMiles(s, l) <= l.radiusMiles && mean >= s.minRating;
    });
    if (matches.length) {
      const body = matches.map((l) => `${l.org.name} — ${l.title}`).join('\n');
      await notifyClient(s.user.email, `${matches.length} new match${matches.length > 1 ? 'es' : ''} for your saved search`, body);
      notified++;
    }
    await db.savedSearch.update({ where: { id: s.id }, data: { checkedAt: at } });
  }
  return { checked: searches.length, notified };
}
