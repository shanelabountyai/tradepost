'use server';
// CONTROL (INV-02): guarded, but the write selects by id alone (the Bookable IDOR).
import { z } from 'zod';
import { orgAction, ref } from '@/core/authz/action';
import { db } from '@/core/db';

export const revoke = orgAction('members.manage', z.object({ id: ref('invite') }), async (_ctx, { id }) => {
  await db.invite.updateMany({ where: { id }, data: { revokedAt: new Date() } });
});
