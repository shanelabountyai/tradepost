import { notFound } from 'next/navigation';
import { audit } from '@/core/audit';
import { now } from '@/core/clock';
import type { Party } from '@/generated/prisma/enums';
import { inProviderTx, type providerDb } from '@/lib/tenancy';

// P0-7: one thread per job between its client and its provider, refreshed by polling. Both sides reach
// it only through their own scoped job client, so a foreign job is notFound. A platform admin reads it
// only while the job is disputed, and every such read is audit-logged in the same transaction.

type Jobs = ReturnType<typeof providerDb>['job'];

/** The thread, oldest first. Spread into a scoped job query: `include: { messages: THREAD }`. */
export const THREAD = { orderBy: { createdAt: 'asc' }, select: { id: true, by: true, body: true, createdAt: true } } as const;

export async function postMessage(jobs: Jobs, id: string, by: Party, body: string) {
  await jobs.update({ where: { id }, data: { messages: { create: { by, body, createdAt: now() } } } }).catch((e) => {
    if (e?.code === 'P2025') notFound();
    throw e;
  });
}

/** Admin (P0-7): a disputed job's thread. Any other status is notFound, and a read that returns writes its audit row. Callers pass requirePlatformAdmin first. */
export function adminReadThread(jobId: string, adminId: string) {
  return inProviderTx(jobId, async (jobs, tx, orgId) => {
    const job = await jobs.findFirst({
      where: { id: jobId, status: 'disputed' },
      select: { listing: { select: { title: true } }, messages: THREAD },
    });
    if (!job) notFound();
    await audit({ orgId, userId: adminId }, 'thread.adminRead', { targetType: 'job', targetId: jobId }, tx);
    return job;
  });
}
