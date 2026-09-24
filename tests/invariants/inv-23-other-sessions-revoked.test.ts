import { beforeEach, describe, expect, it } from 'vitest';
import { sessionFor } from '@/core/auth/session';
import { disableTotp, redeemRecoveryCode } from '@/core/auth/totp';
import { enrol, makeUser, resetAuthTables, signInAs } from '../helpers/auth';

beforeEach(resetAuthTables);

describe('INV-23 a TOTP change or recovery-code use deletes all other sessions', () => {
  it('enrolling keeps only this session', async () => {
    const u = await makeUser();
    const other = await signInAs(u.id);
    const here = await signInAs(u.id);
    await enrol();
    expect(await sessionFor(other)).toBeNull();
    expect(await sessionFor(here)).not.toBeNull();
  });

  it('disabling keeps only this session', async () => {
    const u = await makeUser();
    await signInAs(u.id);
    await enrol();
    const other = await signInAs(u.id, { mfa: true });
    const here = await signInAs(u.id, { mfa: true });
    await disableTotp();
    expect(await sessionFor(other)).toBeNull();
    expect(await sessionFor(here)).not.toBeNull();
  });

  it('a recovery code keeps only this session', async () => {
    const u = await makeUser();
    await signInAs(u.id);
    const { codes } = await enrol();
    const other = await signInAs(u.id, { mfa: true });
    const here = await signInAs(u.id);
    expect(await redeemRecoveryCode(codes[0]!)).toBe(true);
    expect(await sessionFor(other)).toBeNull();
    expect((await sessionFor(here))!.mfaAt).not.toBeNull();
  });
});
