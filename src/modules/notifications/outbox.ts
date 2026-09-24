import { sendEmail } from '@/core/email/transport';
import { now } from '@/core/clock';
import { db } from '@/core/db';
import { log } from '@/core/log';
import type { Prisma } from '@/generated/prisma/client';
import { sendSms } from './sms';
import { render } from './templates';

export const MAX_ATTEMPTS = 5;
const BACKOFF_MS = [1, 5, 30, 120].map((m) => m * 60_000); // after attempt 1..4; then it stays failed

export type Enqueue = { channel: 'email' | 'sms'; to: string; template: string; data?: Record<string, unknown>; orgId?: string; sendAfter?: Date };

/** Queue a message. Pass `tx` to enqueue inside the caller's transaction so the two commit together. */
export async function enqueue(m: Enqueue, tx: Pick<typeof db, 'outbox'> = db) {
  render(m.template, m.data); // fail at the call site on a typo, not silently at drain time
  return tx.outbox.create({ data: { ...m, data: (m.data ?? {}) as Prisma.InputJsonObject }, select: { id: true } });
}

/**
 * Sends due messages. Each row is claimed with FOR UPDATE SKIP LOCKED inside a transaction that
 * also does the send and the bookkeeping, so two overlapping drains never take the same row.
 * Delivery is at-least-once: a crash between the provider accepting and the commit sends it again.
 * A failure backs the row off; after MAX_ATTEMPTS it stays unsent with `lastError` for a human.
 */
export async function drainOutbox(limit = 25): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < limit; i++) {
    const outcome = await db.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<{ id: string; channel: string; to: string; template: string; data: unknown; attempts: number }[]>`
        SELECT id, channel, "to", template, data, attempts FROM "Outbox"
        WHERE "sentAt" IS NULL AND "sendAfter" <= ${now()} AND attempts < ${MAX_ATTEMPTS}
        ORDER BY "sendAfter" LIMIT 1 FOR UPDATE SKIP LOCKED`;
      if (!row) return null;
      try {
        const { subject, body } = render(row.template, row.data);
        if (row.channel === 'sms') await sendSms({ to: row.to, body });
        else await sendEmail({ to: row.to, subject, body });
        await tx.outbox.update({ where: { id: row.id }, data: { sentAt: now(), attempts: { increment: 1 }, lastError: null } });
        return 'sent';
      } catch (err) {
        const attempts = row.attempts + 1;
        // Error text can echo provider detail but never our body or address: sendEmail/sendSms throw status-only messages.
        await tx.outbox.update({
          where: { id: row.id },
          data: { attempts, lastError: (err instanceof Error ? err.message : String(err)).slice(0, 500), sendAfter: new Date(now().getTime() + (BACKOFF_MS[attempts - 1] ?? BACKOFF_MS.at(-1)!)) },
        });
        log('outbox.failed', { id: row.id, attempts });
        return 'failed';
      }
    });
    if (!outcome) break;
    if (outcome === 'sent') sent++;
    else failed++;
  }
  return { sent, failed };
}

/** Old sent rows carry addresses and payloads; nothing reads them after a week. */
export async function sweepOutbox(): Promise<number> {
  const { count } = await db.outbox.deleteMany({ where: { sentAt: { lt: new Date(now().getTime() - 7 * 86_400_000) } } });
  return count;
}
