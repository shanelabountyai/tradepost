import { defineConfig } from 'prisma/config';
import { assertLocalOrAllowed } from './src/core/db/local-guard';

// Prisma 7 no longer auto-loads .env. Test runs inject DATABASE_URL via
// `dotenv -e .env.test`; this covers the plain CLI in development.
if (!process.env.DATABASE_URL) {
  const { config } = await import('dotenv');
  config({ path: '.env.local', quiet: true });
}

// Migrations need Neon's unpooled URL; runtime uses the pooled DATABASE_URL (spec §6).
// Unset during `prisma generate` (CI, postinstall), which does not connect.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '';
assertLocalOrAllowed(url);

export default defineConfig({
  schema: 'prisma/schema',
  migrations: { path: 'prisma/migrations' },
  datasource: { url, shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL },
});
