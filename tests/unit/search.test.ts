import { describe, expect, it } from 'vitest';
import { haversineMiles, rankListings, weekday } from '@/lib/search';

// P0-2 ranking against hand-built fixtures. `north(mi)` is a point that many miles north of the client.
const at = { lat: 30.2672, lng: -97.7431 };
const MI_PER_DEGREE = (2 * Math.PI * 3958.8) / 360;
const north = (mi: number) => ({ lat: at.lat + mi / MI_PER_DEGREE, lng: at.lng });
const L = (id: string, mi: number, radiusMiles: number, rating: [number, number] | null) => ({
  id, ...north(mi), radiusMiles, rating: rating && { count: rating[0], sum: rating[1] },
});

const fixtures = [
  L('near-4.5x2', 0, 5, [2, 9]),
  L('unrated', 1, 5, null),
  L('far-4.5x2', 3, 5, [2, 9]),
  L('5.0-outside-its-area', 20, 10, [1, 5]), // best rating, but the client is 20 mi out of a 10 mi area
  L('4.5x10', 2, 5, [10, 45]),
  L('5.0x2', 4, 25, [2, 10]),
];

describe('haversineMiles', () => {
  it('one degree of latitude is ~69.09 mi, and distance is symmetric', () => {
    expect(haversineMiles({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(69.09, 2);
    expect(haversineMiles(at, north(12))).toBeCloseTo(12, 6);
    expect(haversineMiles(north(12), at)).toBeCloseTo(haversineMiles(at, north(12)), 9);
  });
});

describe('weekday', () => {
  it('reads a calendar date the same in every server time zone', () => {
    expect(weekday('2026-09-27')).toBe(0); // a Sunday
    expect(weekday('2026-09-25')).toBe(5);
  });
});

describe('rankListings', () => {
  it('ranks by rating, then review count, then distance, inside each service area', () => {
    expect(rankListings(fixtures, at).map((l) => l.id)).toEqual(['5.0x2', '4.5x10', 'near-4.5x2', 'far-4.5x2', 'unrated']);
  });

  it('min rating drops unrated providers and anything below it', () => {
    expect(rankListings(fixtures, at, 3).map((l) => l.id)).toEqual(['5.0x2', '4.5x10', 'near-4.5x2', 'far-4.5x2']);
    expect(rankListings(fixtures, at, 5).map((l) => l.id)).toEqual(['5.0x2']);
  });
});
