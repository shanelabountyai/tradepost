import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// P0-1: provider-owned tables are reached only through src/lib/tenancy.ts. Scans src/ (tests and
// seed scripts set up fixtures directly, on purpose). Add a model here when it becomes provider-owned.
// ledgerEntry: money rows are written only as part of a job transition (src/lib/jobs.ts), never directly.
// review, dispute (P0-5/6): reviews are blind and statements admin-only, so outside src/lib they are not
// even reachable as a nested relation of a scoped job; pages spread reviewsVisibleTo() instead.
const MODELS = ['listing', 'job', 'ledgerEntry', 'review', 'dispute'];
const RELATIONS = /\b(reviews|dispute)\s*:/;
const LAYER = 'src/lib/tenancy.ts';
const ROOT = path.resolve(import.meta.dirname, '../..');

const cap = (m: string) => m[0]!.toUpperCase() + m.slice(1);
const RAW_CLIENT = new RegExp(`\\b(db|tx|prisma)\\s*\\.\\s*(${MODELS.join('|')})\\b`);
const RAW_SQL = new RegExp(`"(${MODELS.map(cap).join('|')})"`);

const violations = (src: string, relations = false) =>
  src.split('\n').flatMap((l, i) => (RAW_CLIENT.test(l) || RAW_SQL.test(l) || (relations && RELATIONS.test(l)) ? [`${i + 1}: ${l.trim()}`] : []));

describe('tenancy lint', () => {
  it('flags raw access and passes scoped access (negative control)', () => {
    expect(violations('await db.job.findMany()')).toHaveLength(1);
    expect(violations('tx . listing.create({})')).toHaveLength(1);
    expect(violations('db.$queryRaw`SELECT * FROM "Job"`')).toHaveLength(1);
    expect(violations('providerDb(ctx).job.findMany(); clientDb(s).job.findFirst()')).toHaveLength(0);
    expect(violations('include: { reviews: true, ledger: true }', true)).toHaveLength(1);
    expect(violations('select: { dispute: { select: { clientStatement: true } } }', true)).toHaveLength(1);
    expect(violations("include: { ...reviewsVisibleTo('client') }; status === 'disputed'", true)).toHaveLength(0);
  });

  it('no file outside the layer touches a provider-owned table directly', () => {
    const bad = globSync('src/**/*.{ts,tsx}', { cwd: ROOT })
      .filter((f) => f !== LAYER && !f.startsWith('src/generated/'))
      .flatMap((f) => violations(readFileSync(path.join(ROOT, f), 'utf8'), !f.startsWith('src/lib/')).map((v) => `${f}:${v}`));
    expect(bad).toEqual([]);
  });
});
