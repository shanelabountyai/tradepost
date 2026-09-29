'use server';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { audit } from '@/core/audit';
import { notRef, ref, userAction } from '@/core/authz/action';
import { now } from '@/core/clock';
import { db } from '@/core/db';
import { Refused } from '@/core/errors';
import { submitStatement, transition, type Transition } from '@/lib/jobs';
import { notifyProvider } from '@/lib/notify';
import { reportTheirReview, submitReview } from '@/lib/reviews';
import { weekday } from '@/lib/search';
import { postMessage } from '@/lib/threads';
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

// P0-6: a dispute freezes the escrow; the statement is read by platform admins only.
const statement = z.string().trim().min(1, 'Say what went wrong.').max(4000);

export const disputeJob = userAction(z.object({ id: ref('job'), statement }), async (s, { id, statement }) => {
  await transition(clientDb(s).job, id, 'dispute', 'client', { statement });
  await audit({ userId: s.userId }, 'job.dispute', { targetType: 'job', targetId: id });
  redirect('/jobs');
});

export const addStatement = userAction(z.object({ id: ref('job'), statement }), async (s, { id, statement }) => {
  await submitStatement(clientDb(s).job, id, 'client', statement);
  redirect('/jobs');
});

// P0-5: the client's review of the pro, hidden from the pro until published.
export const reviewPro = userAction(
  z.object({ id: ref('job'), stars: z.coerce.number().int().min(1).max(5), body: z.string().trim().max(2000).default('') }),
  async (s, { id, stars, body }) => {
    await submitReview(clientDb(s).job, id, 'client', stars, body);
    await audit({ userId: s.userId }, 'review.submit', { targetType: 'job', targetId: id });
    redirect('/jobs');
  },
);

// D-024 (F-16): report the pro's published review of this client to Tradepost moderation.
const reason = z.string().trim().min(1, 'Say what is wrong with it.').max(1000);

export const reportReviewOfMe = userAction(z.object({ id: ref('job'), reason }), async (s, { id, reason }) => {
  await reportTheirReview(clientDb(s).job, id, 'client', reason);
  await audit({ userId: s.userId }, 'review.report', { targetType: 'job', targetId: id });
  redirect('/jobs');
});

// P0-7: the job's thread with the pro.
const message = z.string().trim().min(1, 'Write a message.').max(4000);

export const sendMessage = userAction(z.object({ id: ref('job'), body: message }), async (s, { id, body }) => {
  await postMessage(clientDb(s).job, id, 'client', body);
  redirect('/jobs');
});

// Not ref('listing'): a listing id is public (it came from /search), and booking another provider's
// listing is the point, so the harness's "another org's id is refused" (INV-02) does not apply to it.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const requestJob = userAction(z.object({ listingId: notRef(z.string().regex(UUID)), date: z.iso.date() }), async (s, i) => {
  const l = await bookableListing(i.listingId);
  if (!l) notFound();
  // A dual-role user may not hire their own business: it would let them review themselves (P0-5).
  if (await db.membership.findFirst({ where: { userId: s.userId, orgId: l.orgId }, select: { orgId: true } })) {
    throw new Refused('You cannot book your own business.');
  }
  if (i.date < now().toISOString().slice(0, 10)) throw new Refused('Pick today or a later date.');
  if (!l.days.includes(weekday(i.date))) throw new Refused('This pro does not work that day.');
  const job = await clientDb(s)
    .job.create({ data: { orgId: l.orgId, listingId: l.id, clientId: s.userId, date: new Date(i.date), amountCents: l.rateCents } })
    .catch((e) => {
      // F-02: the partial unique index "Job_one_active_per_date" (a stale tab or a double submit)
      if (e?.code === 'P2002') throw new Refused('You already requested this pro for that date. See it in Your jobs.');
      // F-31: the listing was deleted after it was read (the provider deleted it or its org).
      if (e?.code === 'P2003') throw new Refused('This listing is no longer available.');
      throw e;
    });
  await audit({ orgId: l.orgId, userId: s.userId }, 'job.request', { targetType: 'job', targetId: job.id });
  await notifyProvider(l.orgId, 'New job request', `You have a new booking request for ${i.date}.`);
  redirect('/jobs');
});
