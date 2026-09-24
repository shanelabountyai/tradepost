import { afterAll, expect, it } from 'vitest';
import { db } from '@/core/db';

afterAll(() => db.$disconnect());

// A Date written by Prisma is the same instant Postgres sees. Without `timezone=UTC` on the
// connection, a non-UTC server zone shifted every write against now() and column defaults (M6).
it('a Prisma-written timestamp is the same instant in SQL', async () => {
  const at = new Date('2026-01-01T00:00:00Z');
  await db.rateLimit.deleteMany({ where: { key: 'tz-check' } });
  await db.rateLimit.create({ data: { key: 'tz-check', windowStart: at, count: 1 } });
  const [row] = await db.$queryRaw<{ e: number }[]>`SELECT extract(epoch FROM "windowStart")::int AS e FROM "RateLimit" WHERE "key" = 'tz-check'`;
  await db.rateLimit.deleteMany({ where: { key: 'tz-check' } });
  expect(row?.e).toBe(at.getTime() / 1000);
});
