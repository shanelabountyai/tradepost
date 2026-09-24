import { beforeEach, describe, expect, it } from 'vitest';
import { advanceClock } from '@/core/clock';
import { sessionFor } from '@/core/auth/session';
import { redeemRecoveryCode, verifyTotp } from '@/core/auth/totp';
import { codeFor, enrol, makeUser, resetAuthTables, signInAs } from '../helpers/auth';

beforeEach(resetAuthTables);

describe('INV-24 TOTP codes and recovery codes work once', () => {
  it('a code is refused a second time within its step, and the next step works', async () => {
    const u = await makeUser();
    await signInAs(u.id);
    const { secret } = await enrol();
    advanceClock(30_000);
    const code = codeFor(secret);
    await signInAs(u.id);
    expect(await verifyTotp(code)).toBe(true);
    const second = await signInAs(u.id);
    expect(await verifyTotp(code)).toBe(false);
    expect((await sessionFor(second))!.mfaAt).toBeNull();
    advanceClock(60_000);
    expect(await verifyTotp(codeFor(secret))).toBe(true);
  });

  it('the code used to confirm enrolment cannot sign in again', async () => {
    const u = await makeUser();
    await signInAs(u.id);
    const { secret } = await enrol();
    await signInAs(u.id);
    expect(await verifyTotp(codeFor(secret))).toBe(false);
  });

  it('a used recovery code is refused', async () => {
    const u = await makeUser();
    await signInAs(u.id);
    const { codes } = await enrol();
    await signInAs(u.id);
    expect(await redeemRecoveryCode(codes[0]!)).toBe(true);
    await signInAs(u.id);
    expect(await redeemRecoveryCode(codes[0]!)).toBe(false);
    expect(await redeemRecoveryCode(codes[1]!.toUpperCase().replace('-', ' '))).toBe(true);
  });
});
