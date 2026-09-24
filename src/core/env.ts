import { z } from 'zod';

// Every key the app reads. `.env.example` must name exactly these (INV-14), and no
// NEXT_PUBLIC_* key may be a secret (INV-20) — the allowlist lives in the invariant test.
// Later milestones add their keys here and to `.env.example` in the same commit.
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(), // migrations only; falls back to DATABASE_URL
  AUTH_SECRET: z.string().min(32), // HKDF root for sealed secrets and token hashing
  APP_URL: z.url(),
  ALLOW_CLOUD_DB: z.enum(['1']).optional(), // INV-18 escape hatch
  VERCEL_ENV: z.string().optional(), // set by Vercel; marks a deployed environment
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((i) => i.path.join('.')))].join(', ');
    throw new Error(`Invalid environment: ${keys}`); // names only — never echo values
  }
  return result.data;
}

export const env = parseEnv(process.env);
