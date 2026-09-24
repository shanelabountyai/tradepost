import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { requestLink } from '@/core/auth/link';
import { enrol, makeUser, resetAuthTables, signInAs } from '../helpers/auth';

beforeEach(resetAuthTables);

// Scope in M2: login token, session, recovery code. Invite (M3) and share link (M4) add theirs.
describe('INV-07 no raw token is stored', () => {
  it('login token, session and recovery codes are stored only hashed', async () => {
    const u = await makeUser();
    const session = await signInAs(u.id, { mfa: true });
    const { codes } = await enrol();
    await requestLink('someone-new@example.test', '10.0.0.1');
    const [msg] = await db.capturedMessage.findMany();
    const link = msg!.body.match(/\/login\/([\w-]+)/)![1]!;

    const dump = JSON.stringify([
      await db.loginToken.findMany(),
      await db.session.findMany(),
      await db.recoveryCode.findMany(),
    ]);
    for (const raw of [link, session, ...codes, ...codes.map((c) => c.replace('-', ''))]) {
      expect(dump).not.toContain(raw);
    }
  });
});
