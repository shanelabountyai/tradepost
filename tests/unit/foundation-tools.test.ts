import { describe, expect, it } from 'vitest';
import { drift, type Change } from '../../scripts/foundation-drift';
import { rewrite } from '../../scripts/new-project';

const none = () => false;
const edit = (path: string, ...lines: string[]): Change => ({ status: 'M', path, lines });

describe('foundation:drift rules', () => {
  it('flags an edit to core, and a new file in core', () => {
    expect(drift([edit('src/core/tokens.ts', '+x')], new Set(), none)).toEqual(['M src/core/tokens.ts']);
    expect(drift([{ status: 'A', path: 'src/core/mine.ts', lines: [] }], new Set(), none)).toEqual(['A src/core/mine.ts']);
  });
  it('flags a deleted core file', () => {
    expect(drift([{ status: 'D', path: 'src/core/cron.ts', lines: [] }], new Set(), none)).toHaveLength(1);
  });
  it('allows a clone-owned back-relation line marked // app, but not the unmarked line beside it', () => {
    expect(drift([edit('prisma/schema/core.prisma', '+  tasks Task[] // app')], new Set(), none)).toEqual([]);
    expect(drift([edit('prisma/schema/core.prisma', '+  tasks Task[] // app', '-  name String')], new Set(), none)).toHaveLength(1);
  });
  it('allows removed // billing lines only once the billing directory is gone', () => {
    const c = edit('prisma/schema/core.prisma', '-  billingAccount BillingAccount? // billing');
    expect(drift([c], new Set(), none)).toHaveLength(1);
    expect(drift([c], new Set(['billing']), none)).toEqual([]);
    expect(drift([edit('prisma/schema/core.prisma', '-  outbox Outbox[] // notifications')], new Set(['billing']), none)).toHaveLength(1);
  });
  it('allows a deleted module to stay deleted, and only that module', () => {
    const del = (path: string): Change => ({ status: 'D', path, lines: [] });
    expect(drift([del('src/modules/billing/webhook.ts'), del('src/app/o/[org]/settings/billing/page.tsx')], new Set(['billing']), none)).toEqual([]);
    expect(drift([del('src/modules/notifications/sms.ts')], new Set(['billing']), none)).toHaveLength(1);
  });
  it("allows a clone's own migrations and schema file, but not an edited template migration", () => {
    expect(drift([{ status: 'A', path: 'prisma/migrations/20270101000000_tasks/migration.sql', lines: [] }, { status: 'A', path: 'prisma/schema/app.prisma', lines: [] }], new Set(), none)).toEqual([]);
    expect(drift([edit('prisma/migrations/20260923000000_core_init/migration.sql', '+x')], new Set(), none)).toHaveLength(1);
  });
  it('allows a path listed in FOUNDATION_PATCHES.md', () => {
    expect(drift([edit('src/core/tokens.ts', '+x')], new Set(), (p) => p === 'src/core/tokens.ts')).toEqual([]);
  });
});

describe('new-project rewrite', () => {
  const files = {
    pkg: JSON.stringify({ name: 'saas-foundation', scripts: { dev: 'next dev -p __PORT__', 'dev:template': 'next dev -p 4100', 'predev:template': 'x', 'dev:test': 'next dev -p 4100' } }),
    playwright: 'const PORT = Number(process.env.PORT ?? 4100);',
    ci: 'APP_URL: http://localhost:4100\nsaas_foundation_test',
    readme: '# SaaS Foundation\n\nbody',
  };
  it('renames, moves the port everywhere, drops the template script', () => {
    const o = rewrite(files, 'my-app', '4200', 'v1.0.0');
    const pkg = JSON.parse(o.pkg);
    expect(pkg.name).toBe('my-app');
    expect(pkg.scripts).toEqual({ dev: 'next dev -p 4200', 'dev:test': 'next dev -p 4200' });
    expect(o.playwright).toContain('4200');
    expect(o.ci).toBe('APP_URL: http://localhost:4200\nmy_app_test');
    expect(o.readme).toMatch(/^# my-app\n\n> Cloned from saas-foundation v1\.0\.0\. Port 4200/);
  });
});
