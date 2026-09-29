import { describe, expect, it, vi } from 'vitest';

vi.unmock('@/lib/geocode');

describe('geocode', () => {
  it('parses a match into {lat, lng}', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { addressMatches: [{ coordinates: { x: -97.7431, y: 30.2672 } }] } })),
    );
    const { geocode } = await import('@/lib/geocode');
    await expect(geocode('123 Main St, Austin TX 78701')).resolves.toEqual({ lat: 30.2672, lng: -97.7431 });
  });

  it('returns null with no match', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ result: { addressMatches: [] } })));
    const { geocode } = await import('@/lib/geocode');
    await expect(geocode('not a real place')).resolves.toBeNull();
  });

  it('returns null on a non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 500 }));
    const { geocode } = await import('@/lib/geocode');
    await expect(geocode('x')).resolves.toBeNull();
  });
});
