import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db';
import { requestLink } from '@/core/auth/link';
import { LIMITS } from '@/core/rate-limit';
import { verifyTotp } from '@/core/auth/totp';
import { currentSession } from '@/core/auth/session';
import { acceptInvite, createInvite } from '@/core/tenancy/invites';
import { actAs, addMember, makeOrg } from '../helpers/org';
import { advanceClock } from '@/core/clock';
import { codeFor, enrol, makeUser, resetAuthTables, signInAs } from '../helpers/auth';

beforeEach(resetAuthTables);

const sent = () => db.loginToken.count();

/** Pins the clock 1s into a fresh 15-minute window (a multiple of every limit's window), plus `ms`. */
const base = Math.ceil(Date.now() / 900_000) * 900_000 + 1000 - Date.now();
const at = (ms = 0) => advanceClock(base + ms);
beforeEach(() => at());

// Scope in M3: link requests (per IP and per email), TOTP attempts, invite accepts. Share reads join in M4.
describe('INV-09 Postgres rate limits', () => {
  it('link requests: the per-IP limit refuses request N+1', async () => {
    const n = LIMITS.linkPerIp.limit;
    for (let i = 0; i < n; i++) await requestLink(`u${i}@example.test`, '10.0.0.9');
    expect(await sent()).toBe(n);
    await requestLink('one-more@example.test', '10.0.0.9');
    expect(await sent()).toBe(n);
    await requestLink('one-more@example.test', '10.0.0.10'); // another IP still gets through
    expect(await sent()).toBe(n + 1);
  });

  it('link requests: the per-email limit refuses request N+1 across IPs, and survives a fresh module', async () => {
    const n = LIMITS.linkPerEmail.limit;
    for (let i = 0; i < n; i++) {
      await requestLink('ada@example.test', `10.0.1.${i}`);
      at((i + 1) * 61_000); // past the 60-second cooldown, inside the window
    }
    expect(await sent()).toBe(n);
    // A fresh module instance (a new serverless instance) still sees the count. Its clock is
    // fresh too, so pin it to the same moment: past the cooldown, inside the window.
    vi.resetModules();
    (await import('@/core/clock')).advanceClock(base + (n + 1) * 61_000);
    const fresh = await import('@/core/auth/link');
    await fresh.requestLink('ada@example.test', '10.0.2.1');
    expect(await sent()).toBe(n);
  });

  it('TOTP attempts: the per-user limit refuses attempt N+1 even with the right code', async () => {
    const u = await makeUser();
    await signInAs(u.id, { mfa: true });
    const { secret } = await enrol();
    await signInAs(u.id); // a new sign-in, MFA pending
    for (let i = 0; i < LIMITS.mfaPerUser.limit; i++) expect(await verifyTotp('000000')).toBe(false);
    at(30_000); // a new step, so replay is not what refuses it
    expect(await verifyTotp(codeFor(secret))).toBe(false);
  });

  it('invite accepts: the per-user limit refuses attempt N+1 even with the right token', async () => {
    const org = await makeOrg();
    const owner = await addMember(org.id, 'owner', 'owner@example.test');
    await createInvite(await actAs(owner.id, org.slug), 'ada@example.test', 'member');
    const token = (await db.capturedMessage.findFirstOrThrow({ where: { to: 'ada@example.test' } })).body.match(/invite\/([\w-]+)/)![1]!;
    await signInAs((await makeUser('ada@example.test')).id);
    const s = (await currentSession())!;
    for (let i = 0; i < LIMITS.inviteAcceptPerUser.limit; i++) await expect(acceptInvite(s, 'guess')).rejects.toThrow('not valid');
    await expect(acceptInvite(s, token)).rejects.toThrow('Too many');
    expect(await db.membership.count({ where: { orgId: org.id } })).toBe(1);
  });
});
