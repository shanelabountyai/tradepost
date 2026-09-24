import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assertLocalOrAllowed } from '@/core/db/local-guard';

const neon = 'postgresql://u:p@ep-x.us-east-2.aws.neon.tech/db';

describe('INV-18 cloud database guard', () => {
  it('refuses a cloud URL by default', () => {
    expect(() => assertLocalOrAllowed(neon, {})).toThrow(/Refusing a cloud database/);
  });
  it('allows it when deployed or explicitly allowed', () => {
    expect(() => assertLocalOrAllowed(neon, { VERCEL_ENV: 'production' })).not.toThrow();
    expect(() => assertLocalOrAllowed(neon, { ALLOW_CLOUD_DB: '1' })).not.toThrow();
  });
  it('allows local', () => {
    expect(() => assertLocalOrAllowed('postgresql://u@localhost:5432/x', {})).not.toThrow();
  });
  it('the Prisma CLI config and the app client both call the guard', () => {
    expect(readFileSync('prisma.config.ts', 'utf8')).toContain('assertLocalOrAllowed(');
    expect(readFileSync('src/core/db/index.ts', 'utf8')).toContain('assertLocalOrAllowed(');
  });
});
