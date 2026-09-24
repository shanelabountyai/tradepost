import { describe, expect, it } from 'vitest';
import { envSchema } from '@/core/env';

// A NEXT_PUBLIC_ var is inlined into the browser bundle. Adding one means adding it here,
// which is the moment to ask whether it is really public.
const PUBLIC_ALLOWLIST: string[] = [];

describe('INV-20 no secret in NEXT_PUBLIC_*', () => {
  it('every NEXT_PUBLIC_ key is allowlisted and not secret-shaped', () => {
    const keys = Object.keys(envSchema.shape).filter((k) => k.startsWith('NEXT_PUBLIC_'));
    for (const k of keys) {
      expect(PUBLIC_ALLOWLIST).toContain(k);
      expect(k).not.toMatch(/SECRET|KEY|TOKEN|PASSWORD/);
    }
  });
});
