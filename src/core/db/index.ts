import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { env } from '@/core/env';
import { assertLocalOrAllowed } from './local-guard';

assertLocalOrAllowed(env.DATABASE_URL, process.env);

// Reused across dev hot reloads so each reload doesn't open a new pool.
const g = globalThis as unknown as { prisma?: PrismaClient };

export const db = (g.prisma ??= new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) }));
