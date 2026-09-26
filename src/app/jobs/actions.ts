'use server';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { audit } from '@/core/audit';
import { ref, userAction } from '@/core/authz/action';
import { now } from '@/core/clock';
import { db } from '@/core/db';
import { Refused } from '@/core/errors';
import { transition, type Transition } from '@/lib/jobs';
import { weekday } from '@/lib/search';
import { bookableListing, clientDb } from '@/lib/tenancy';

// P0-3: a client's side of a job. Every move goes through clientDb, so another client's job is notFound.
const move = (name: Transition) =>
  userAction(z.object({ id: ref('job') }), async (s, { id }) => {
    await transition(clientDb(s).job, id, name, 'client');
    await audit({ userId: s.userId }, `job.${name}`, { targetType: 'job', targetId: id });
    redirect('/jobs');
  });

export const withdrawJob = move('withdraw');
export const cancelJob = move('cancel');
export const confirmJob = move('confirm');

// Not ref('listing'): a listing id is public (it came from /search), and booking another provider's
// listing is the point, so the harness's "another org's id is refused" (INV-02) does not apply to it.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const requestJob = userAction(z.object({ listingId: z.string().regex(UUID), date: z.iso.date() }), async (s, i) => {
  const l = await bookableListing(i.listingId);
  if (!l) notFound();
  // A dual-role user may not hire their own business: it would let them review themselves (P0-5).
  if (await db.membership.findFirst({ where: { userId: s.userId, orgId: l.orgId }, select: { orgId: true } })) {
    throw new Refused('You cannot book your own business.');
  }
  if (i.date < now().toISOString().slice(0, 10)) throw new Refused('Pick today or a later date.');
  if (!l.days.includes(weekday(i.date))) throw new Refused('This pro does not work that day.');
  const job = await clientDb(s).job.create({
    data: { orgId: l.orgId, listingId: l.id, clientId: s.userId, date: new Date(i.date), amountCents: l.rateCents },
  });
  await audit({ orgId: l.orgId, userId: s.userId }, 'job.request', { targetType: 'job', targetId: job.id });
  redirect('/jobs');
});
