import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { requestLink } from '@/core/auth/link';
import { createInvite } from '@/core/tenancy/invites';
import { actAs, addMember, makeOrg } from '../helpers/org';
import { enrol, makeUser, resetAuthTables, signInAs } from '../helpers/auth';

beforeEach(resetAuthTables);

// Scope in M3: login token, session, recovery code, invite. Share link (M4) adds its own.
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

describe('INV-07 invites (M3 scope)', () => {
  it('an invite is stored only hashed', async () => {
    const org = await makeOrg();
    const owner = await addMember(org.id, 'owner', 'owner@example.test');
    await createInvite(await actAs(owner.id, org.slug), 'new@example.test', 'member');
    const [msg] = await db.capturedMessage.findMany({ where: { to: 'new@example.test' } });
    const raw = msg!.body.match(/\/onboarding\/invite\/([\w-]+)/)![1]!;
    expect(JSON.stringify(await db.invite.findMany())).not.toContain(raw);
  });
});
