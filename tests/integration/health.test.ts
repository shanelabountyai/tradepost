import { afterAll, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { GET } from '@/app/api/health/route';

afterAll(() => db.$disconnect());

describe('/api/health', () => {
  it('is ok against the local database', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
