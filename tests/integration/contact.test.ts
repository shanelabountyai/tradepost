import { beforeEach, describe, expect, it } from 'vitest';
import { clearContactPhone, setContactPhone } from '@/app/o/[org]/settings/contact/actions';
import { db } from '@/core/db';
import { resetAuthTables } from '../helpers/auth';
import { NavSignal } from '../helpers/next';
import { actAs, addMember, makeOrg } from '../helpers/org';

// D-021: an org's SMS contact number, owner/admin only (manageAction, like listings).
beforeEach(resetAuthTables);

const outcome = (e: unknown) => (e instanceof NavSignal ? e.kind : e);

describe('setContactPhone / clearContactPhone', () => {
  it('rejects a malformed number, saves a valid one, and a member cannot set it', async () => {
    const p = await makeOrg('p');
    const owner = await addMember(p.id, 'owner', 'o@example.test');
    const member = await addMember(p.id, 'member', 'm@example.test');

    await actAs(owner.id, 'p');
    expect(await setContactPhone('p', { phone: '5125550100' })).toEqual({ error: 'Enter a phone number in +1XXXXXXXXXX format.' });
    expect(await setContactPhone('p', { phone: '+15125550100' }).catch(outcome)).toBe('redirect');
    expect(await db.orgContact.findUnique({ where: { orgId: p.id } })).toMatchObject({ phone: '+15125550100' });

    await actAs(member.id, 'p');
    expect(await setContactPhone('p', { phone: '+15125550199' }).catch(outcome)).toBe('notFound');
    expect((await db.orgContact.findUnique({ where: { orgId: p.id } }))?.phone).toBe('+15125550100'); // unchanged
  });

  it('a second org cannot see or clear another org’s number', async () => {
    const [p, q] = [await makeOrg('p'), await makeOrg('q')];
    const [ownerP, ownerQ] = await Promise.all([addMember(p.id, 'owner', 'op@example.test'), addMember(q.id, 'owner', 'oq@example.test')]);
    await actAs(ownerP.id, 'p');
    await setContactPhone('p', { phone: '+15125550100' }).catch(outcome);

    await actAs(ownerQ.id, 'q');
    expect(await clearContactPhone('q', {}).catch(outcome)).toBe('redirect'); // nothing to clear, still succeeds
    expect((await db.orgContact.findUnique({ where: { orgId: p.id } }))?.phone).toBe('+15125550100'); // untouched
  });
});
