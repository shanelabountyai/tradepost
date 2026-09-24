import { now } from '@/core/clock';
import { db } from '@/core/db';

// Fixed-window counters in Postgres (INV-09), so a limit survives a cold start and holds
// across every serverless instance. One atomic upsert per hit: no read-then-write race.
// ponytail: fixed window allows up to 2× the limit across a window edge; switch to a sliding
// window if that burst ever matters. Old rows are never swept; add a delete to /api/cron (M5).
export const LIMITS = {
  linkPerIp: { limit: 10, windowMs: 15 * 60_000 },
  linkPerEmail: { limit: 5, windowMs: 15 * 60_000 },
  // Per user. A 6-digit code is 10^6 wide; with drift ±1 this caps guessing at ~1e-5 per window.
  mfaPerUser: { limit: 8, windowMs: 5 * 60_000 },
} as const;

export type Limit = (typeof LIMITS)[keyof typeof LIMITS];

/** Counts one hit against `key`. True when the hit is within the limit. */
export async function hit(key: string, { limit, windowMs }: Limit): Promise<boolean> {
  const windowStart = new Date(Math.floor(now().getTime() / windowMs) * windowMs);
  const [row] = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "windowStart", "count") VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimit"."count" + 1
    RETURNING "count"`;
  return row!.count <= limit;
}
