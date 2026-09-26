'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { audit } from '@/core/audit';
import { orgAction, ref } from '@/core/authz/action';
import { submitStatement, transition, type Transition } from '@/lib/jobs';
import { submitReview } from '@/lib/reviews';
import { providerDb } from '@/lib/tenancy';

// P0-3: a provider's moves on its own jobs. Release is not among them (TRANSITIONS: client or cron only).
const move = (name: Transition) =>
  orgAction(null, z.object({ id: ref('job') }), async (ctx, { id }) => {
    await transition(providerDb(ctx).job, id, name, 'provider');
    await audit(ctx, `job.${name}`, { targetType: 'job', targetId: id });
    redirect(`/o/${ctx.slug}/jobs`);
  });

export const acceptJob = move('accept');
export const declineJob = move('decline');
export const startJob = move('start');
export const completeJob = move('complete');
export const cancelJobAsProvider = move('cancel');

// P0-6: the provider's side of a dispute. The statement is read by platform admins only.
const statement = z.string().trim().min(1, 'Say what went wrong.').max(4000);

export const disputeJobAsProvider = orgAction(null, z.object({ id: ref('job'), statement }), async (ctx, { id, statement }) => {
  await transition(providerDb(ctx).job, id, 'dispute', 'provider', { statement });
  await audit(ctx, 'job.dispute', { targetType: 'job', targetId: id });
  redirect(`/o/${ctx.slug}/jobs`);
});

export const addStatementAsProvider = orgAction(null, z.object({ id: ref('job'), statement }), async (ctx, { id, statement }) => {
  await submitStatement(providerDb(ctx).job, id, 'provider', statement);
  redirect(`/o/${ctx.slug}/jobs`);
});

// P0-5: the provider's review of the client, hidden from the client until published.
export const reviewClient = orgAction(
  null,
  z.object({ id: ref('job'), stars: z.coerce.number().int().min(1).max(5), body: z.string().trim().max(2000).default('') }),
  async (ctx, { id, stars, body }) => {
    await submitReview(providerDb(ctx).job, id, 'provider', stars, body);
    await audit(ctx, 'review.submit', { targetType: 'job', targetId: id });
    redirect(`/o/${ctx.slug}/jobs`);
  },
);
