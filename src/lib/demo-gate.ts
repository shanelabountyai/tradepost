// The demo gate itself lives in core since saas-foundation v1.6.5 (src/core/demo-gate.ts, read through @/core/env, K11).
// This file keeps only what is this clone's: the paths that carry their own credential.
export { gate, type Gate } from '@/core/demo-gate';

/** Paths that carry their own credential, so a machine caller is never asked for the password. */
export const ownCredential = (path: string) =>
  ['/api/cron', '/api/webhooks/stripe'].includes(path); // CRON_SECRET, Stripe's signature
