// P0-2 matching. Pure: the database narrows by category and weekday (src/lib/tenancy.ts
// `searchableListings`), then this filters by service area and rating and ranks the rest.

export type Point = { lat: number; lng: number };
export type Candidate = Point & { radiusMiles: number; rating: { count: number; sum: number } | null };
export type Ranked<T> = T & { distanceMiles: number; ratingMean: number; ratingCount: number };

const EARTH_MILES = 3958.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineMiles(a: Point, b: Point): number {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.sqrt(h));
}

/** 0 = Sunday. A 'YYYY-MM-DD' date is a calendar day, so read it in UTC, never the server's zone. */
export const weekday = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`).getUTCDay();

/**
 * The client must be inside the listing's service area. Unrated providers score 0, so any
 * minRating above 0 drops them. Order: mean rating desc, review count desc, distance asc.
 */
export function rankListings<T extends Candidate>(listings: T[], at: Point, minRating = 0): Ranked<T>[] {
  return listings
    .map((l) => {
      const count = l.rating?.count ?? 0;
      return { ...l, distanceMiles: haversineMiles(at, l), ratingCount: count, ratingMean: count ? l.rating!.sum / count : 0 };
    })
    .filter((l) => l.distanceMiles <= l.radiusMiles && l.ratingMean >= minRating)
    .sort((a, b) => b.ratingMean - a.ratingMean || b.ratingCount - a.ratingCount || a.distanceMiles - b.distanceMiles);
}
