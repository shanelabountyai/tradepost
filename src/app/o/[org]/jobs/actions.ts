'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { audit } from '@/core/audit';
import { orgAction, ref } from '@/core/authz/action';
import { transition, type Transition } from '@/lib/jobs';
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
