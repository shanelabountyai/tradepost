const CLOUD = /neon\.tech|rds\.amazonaws|supabase\.co/;

// INV-18: refuse a cloud database unless deployed (VERCEL_ENV) or ALLOW_CLOUD_DB=1.
// Kept dependency-free: prisma.config.ts imports it too.
export function assertLocalOrAllowed(url: string, e: Record<string, string | undefined> = process.env) {
  if (!e.VERCEL_ENV && e.ALLOW_CLOUD_DB !== '1' && CLOUD.test(url)) {
    throw new Error('Refusing a cloud database. Set ALLOW_CLOUD_DB=1 to reach one deliberately (INV-18).');
  }
}
