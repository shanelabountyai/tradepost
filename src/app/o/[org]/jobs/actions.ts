'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { audit } from '@/core/audit';
import { orgAction, ref } from '@/core/authz/action';
import { submitStatement, transition, type Transition } from '@/lib/jobs';
import { reportTheirReview, submitReview } from '@/lib/reviews';
import { manageAction } from '@/lib/roles';
import { providerDb } from '@/lib/tenancy';
import { postMessage } from '@/lib/threads';

// P0-3: a provider's moves on its own jobs. Release is not among them (TRANSITIONS: client or cron only).
// D-009 (F-01): every move, dispute and review is owner/admin only (manageAction); a member can message.
const move = (name: Transition) =>
  manageAction(z.object({ id: ref('job') }), async (ctx, { id }) => {
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

export const disputeJobAsProvider = manageAction(z.object({ id: ref('job'), statement }), async (ctx, { id, statement }) => {
  await transition(providerDb(ctx).job, id, 'dispute', 'provider', { statement });
  await audit(ctx, 'job.dispute', { targetType: 'job', targetId: id });
  redirect(`/o/${ctx.slug}/jobs`);
});

export const addStatementAsProvider = manageAction(z.object({ id: ref('job'), statement }), async (ctx, { id, statement }) => {
  await submitStatement(providerDb(ctx).job, id, 'provider', statement);
  redirect(`/o/${ctx.slug}/jobs`);
});

// P0-5: the provider's review of the client, hidden from the client until published.
export const reviewClient = manageAction(
  z.object({ id: ref('job'), stars: z.coerce.number().int().min(1).max(5), body: z.string().trim().max(2000).default('') }),
  async (ctx, { id, stars, body }) => {
    await submitReview(providerDb(ctx).job, id, 'provider', stars, body);
    await audit(ctx, 'review.submit', { targetType: 'job', targetId: id });
    redirect(`/o/${ctx.slug}/jobs`);
  },
);

// D-024 (F-16): report the client's published review of this provider to Tradepost moderation.
export const reportReviewOfUs = manageAction(
  z.object({ id: ref('job'), reason: z.string().trim().min(1, 'Say what is wrong with it.').max(1000) }),
  async (ctx, { id, reason }) => {
    await reportTheirReview(providerDb(ctx).job, id, 'provider', reason);
    await audit(ctx, 'review.report', { targetType: 'job', targetId: id });
    redirect(`/o/${ctx.slug}/jobs`);
  },
);

// P0-7: the job's thread with the client.
const message = z.string().trim().min(1, 'Write a message.').max(4000);

export const sendMessageAsProvider = orgAction(null, z.object({ id: ref('job'), body: message }), async (ctx, { id, body }) => {
  await postMessage(providerDb(ctx).job, id, 'provider', body);
  redirect(`/o/${ctx.slug}/jobs`);
});
