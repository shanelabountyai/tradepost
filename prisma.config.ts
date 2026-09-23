import { defineConfig } from 'prisma/config';

// Prisma 7 no longer auto-loads .env. Test runs inject DATABASE_URL via
// `dotenv -e .env.test`; this covers the plain CLI in development.
if (!process.env.DATABASE_URL) {
  const { config } = await import('dotenv');
  config({ path: '.env.local', quiet: true });
}

// Migrations need Neon's unpooled URL; runtime uses the pooled DATABASE_URL (spec §6).
// Unset during `prisma generate` (CI, postinstall), which does not connect.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '';
// INV-18: a mistyped env pointing a migration at a cloud database is the accident
// this catches. Reaching one on purpose has to be typed: FOUNDATION_ALLOW_CLOUD_DB=1.
if (!process.env.FOUNDATION_ALLOW_CLOUD_DB && /neon\.tech|rds\.amazonaws|supabase\.co/.test(url)) {
  throw new Error('Refusing a cloud database. Set FOUNDATION_ALLOW_CLOUD_DB=1 for a deliberate deploy.');
}

export default defineConfig({
  schema: 'prisma/schema',
  migrations: { path: 'prisma/migrations' },
  datasource: { url, shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL },
});
