import { beforeEach, describe, expect, it } from 'vitest';
import { sessionFor, signOutEverywhere } from '@/core/auth/session';
import { makeUser, resetAuthTables, signInAs } from '../helpers/auth';

beforeEach(resetAuthTables);

describe('INV-05 sign-out-everywhere (M2 scope)', () => {
  it('ends every session on the next request', async () => {
    const u = await makeUser();
    const a = await signInAs(u.id);
    const b = await signInAs(u.id);
    const other = await signInAs((await makeUser('bob@example.test')).id);
    await signOutEverywhere(u.id);
    expect(await sessionFor(a)).toBeNull();
    expect(await sessionFor(b)).toBeNull();
    expect(await sessionFor(other)).not.toBeNull();
  });
});
