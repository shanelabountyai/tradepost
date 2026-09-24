import { describe, expect, it } from 'vitest';
import { discover, runInvariants } from './harness';

// INV-01 anonymous refused · INV-02 other org's ids refused · INV-03 one secondary id swapped ·
// INV-04 cross-org ≡ nonexistent · INV-22 unenrolled admin refused. Every 'use server' export in
// src/app and src/modules is found by glob, so a clone's actions are covered with no registration.
describe('every server action', () => {
  it('is discovered by glob', async () => {
    const names = (await discover()).map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining(['startOrg', 'joinOrg', 'setRole', 'removeFromOrg', 'inviteMember', 'destroyOrg', 'deleteMyAccount', 'submitTotp']));
  });

  it('passes INV-01/02/03/04/22', async () => {
    const findings = await runInvariants(await discover());
    expect(findings).toEqual([]);
  }, 180_000);
});

// Each control is a known-bad action. If one stops turning its invariant red, the harness is blind.
describe.each([
  ['unwrapped.ts', 'INV-01'],
  ['fake-wrapped.ts', 'INV-01'],
  ['unscoped-where.ts', 'INV-02'],
  ['unscoped-secondary.ts', 'INV-03'],
  ['echo-before-authz.ts', 'INV-04'],
  ['own-membership-check.ts', 'INV-22'],
])('control %s', (file, inv) => {
  it(`turns ${inv} red`, async () => {
    const findings = await runInvariants(await discover(`tests/invariants/controls/${file}`));
    expect(findings.map((f) => f.inv)).toContain(inv);
    expect(findings.filter((f) => f.inv === 'HARNESS')).toEqual([]);
  });
});
