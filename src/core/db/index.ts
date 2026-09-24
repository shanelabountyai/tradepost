import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { env } from '@/core/env';
import { assertLocalOrAllowed } from './local-guard';

assertLocalOrAllowed(env.DATABASE_URL, process.env);

// Reused across dev hot reloads so each reload doesn't open a new pool.
const g = globalThis as unknown as { prisma?: PrismaClient };

// timezone=UTC: the adapter sends a Date with no offset, so Postgres reads it in the session zone.
// On a laptop set to America/Chicago every write landed 5-6h off against now() and column defaults
// (found in M6: a SQL-seeded session read as expired). Cloud Postgres defaults to UTC, which hid it.
export const db = (g.prisma ??= new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL, options: '-c timezone=UTC' }),
}));
