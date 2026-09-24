import { expect, test } from '@playwright/test';

// INV-15. Scope so far: a public page and the API. The signed-in route lands in M2/M3
// and the share route in M4; each adds its path here.
for (const path of ['/', '/api/health']) {
  test(`INV-15 global headers on ${path}`, async ({ request }) => {
    const h = (await request.get(path)).headers();
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['strict-transport-security']).toContain('max-age=');
  });
}

test('health is ok', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});
