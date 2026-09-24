import { beforeEach, describe, expect, it } from 'vitest';
import { advanceClock } from '@/core/clock';
import { ReauthRequired } from '@/core/auth/session';
import { disableTotp, enrolTotp } from '@/core/auth/totp';
import { db } from '@/core/db';
import { enrol, makeUser, resetAuthTables, signInAs } from '../helpers/auth';

beforeEach(resetAuthTables);

// Scope in M2: TOTP enrol and disable. Org and account deletion join in M3.
describe('INV-26 sensitive changes need a sign-in within 5 minutes', () => {
  it('enrolling on a stale session is refused', async () => {
    await signInAs((await makeUser()).id);
    advanceClock(5 * 60_000 + 1000);
    await expect(enrolTotp()).rejects.toBeInstanceOf(ReauthRequired);
  });

  it('disabling on a stale session is refused and changes nothing', async () => {
    const u = await makeUser();
    await signInAs(u.id);
    await enrol();
    advanceClock(5 * 60_000 + 1000);
    await expect(disableTotp()).rejects.toBeInstanceOf(ReauthRequired);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).totpEnrolledAt).not.toBeNull();
  });
});
