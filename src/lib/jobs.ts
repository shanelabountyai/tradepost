import { notFound } from 'next/navigation';
import { audit } from '@/core/audit';
import { now } from '@/core/clock';
import { Refused } from '@/core/errors';
import type { JobStatus, LedgerKind } from '@/generated/prisma/enums';
import { dueForAutoConfirm, providerDb } from '@/lib/tenancy';

// P0-3/P0-4: the job lifecycle and its escrow, as one table. A job moves only through transition(),
// and each move writes its ledger rows in the same statement as the status change, so money and
// state cannot disagree. Disputes (P0-6) add their rows here.

export type Actor = 'client' | 'provider' | 'system';
type Money = 'hold' | 'release' | 'refund' | null;

export const TRANSITIONS = {
  accept: { by: ['provider'], from: 'requested', to: 'accepted', money: 'hold' },
  decline: { by: ['provider'], from: 'requested', to: 'declined', money: null }, // nothing was held
  withdraw: { by: ['client'], from: 'requested', to: 'cancelled', money: null },
  cancel: { by: ['client', 'provider'], from: 'accepted', to: 'cancelled', money: 'refund' }, // full refund; fees are P1
  start: { by: ['provider'], from: 'accepted', to: 'in_progress', money: null },
  complete: { by: ['provider'], from: 'in_progress', to: 'completed', money: null },
  // Release: the client's confirmation, or the 72h auto-confirm. Never the provider.
  confirm: { by: ['client'], from: 'completed', to: 'closed', money: 'release' },
  autoConfirm: { by: ['system'], from: 'completed', to: 'closed', money: 'release' },
} as const satisfies Record<string, { by: readonly Actor[]; from: JobStatus; to: JobStatus; money: Money }>;

export type Transition = keyof typeof TRANSITIONS;

export const AUTO_CONFIRM_MS = 72 * 3_600_000;
export const PLATFORM_FEE_BPS = 1000; // 10%, taken at release

/** The ledger rows one move writes. The fee rounds down, and the provider gets the rest, so the rows sum exactly. */
export function ledgerRows(money: Money, amountCents: number): { kind: LedgerKind; amountCents: number }[] {
  if (money === 'hold' || money === 'refund') return [{ kind: money, amountCents }];
  if (money !== 'release') return [];
  const fee = Math.floor((amountCents * PLATFORM_FEE_BPS) / 10_000);
  return [{ kind: 'release' as const, amountCents: amountCents - fee }, { kind: 'fee' as const, amountCents: fee }].filter((r) => r.amountCents > 0);
}

/**
 * The escrow invariant (P0-4) for one job's rows: `held` is the hold row, `out` everything paid from it.
 * Balanced means nothing was held and nothing paid, or `out` is 0 (still in escrow) or all of `held`.
 */
export function escrow(rows: { kind: LedgerKind; amountCents: number }[]) {
  const sum = (k: LedgerKind[]) => rows.filter((r) => k.includes(r.kind)).reduce((s, r) => s + r.amountCents, 0);
  const held = sum(['hold']);
  const out = sum(['release', 'fee', 'refund']);
  return { held, out, inEscrow: held - out, settled: held > 0 && out === held };
}

// Both scoped clients have the same shape; only their injected filter differs.
type Jobs = ReturnType<typeof providerDb>['job'];

/**
 * Moves one job, through the caller's scoped client, so a foreign id is notFound. The update is
 * conditional on the status just read: a concurrent move (a double-click, the cron racing a confirm)
 * matches nothing and is refused, never applied twice.
 */
export async function transition(jobs: Jobs, id: string, name: Transition, by: Actor) {
  const t = TRANSITIONS[name];
  if (!(t.by as readonly Actor[]).includes(by)) throw new Error(`A ${by} cannot ${name} a job.`);
  const job = await jobs.findFirst({ where: { id }, select: { status: true, amountCents: true } });
  if (!job) notFound();
  if (job.status !== t.from) throw new Refused(`That step is not open while the job is ${job.status.replace('_', ' ')}.`);
  const at = now();
  const rows = ledgerRows(t.money, job.amountCents);
  await jobs
    .update({
      where: { id, status: t.from },
      data: {
        status: t.to,
        ...(t.to === 'completed' && { completedAt: at }),
        ...(t.to === 'closed' && { closedAt: at }),
        ...(rows.length && { ledger: { createMany: { data: rows.map((r) => ({ ...r, createdAt: at })) } } }),
      },
    })
    .catch((e) => {
      if (e?.code === 'P2025') throw new Refused('This job just changed. Reload and try again.');
      throw e;
    });
}

/** Cron (P0-3): closes every job completed 72h ago on the injected clock, releasing its escrow. */
export async function autoConfirmDue() {
  const due = await dueForAutoConfirm(new Date(now().getTime() - AUTO_CONFIRM_MS));
  let confirmed = 0;
  for (const j of due) {
    try {
      await transition(providerDb(j).job, j.id, 'autoConfirm', 'system');
    } catch (e) {
      if (e instanceof Refused) continue; // the client confirmed it (or it moved) since the read
      throw e;
    }
    await audit({ orgId: j.orgId, userId: null }, 'job.autoConfirm', { targetType: 'job', targetId: j.id });
    confirmed++;
  }
  return { confirmed };
}
