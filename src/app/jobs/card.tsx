import type { JobStatus, LedgerKind, Party } from '@/generated/prisma/enums';
import { escrow, ledgerRows } from '@/lib/jobs';

// D-011: the job card's shared parts, for the client's /jobs and the provider's /o/[org]/jobs.
// Money on the card is read from the ledger rows, never recomputed, except the "once released"
// projection, which uses the same ledgerRows() the release will write, so the rounding matches.

export const $ = (cents: number) => `$${(cents / 100).toFixed(2)}`;
export const day = (d: Date) => d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
export const when = (d: Date) =>
  `${d.toLocaleString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} UTC`;
export const shortId = (id: string) => `#${id.slice(0, 6)}`;

// Status is a colour family, a glyph and a word; never colour alone.
const STATUS: Record<JobStatus, [fam: string, glyph: string, label: string]> = {
  requested: ['pending', '○', 'Requested'],
  accepted: ['active', '◔', 'Accepted'],
  in_progress: ['active', '◑', 'In progress'],
  completed: ['held', '◆', 'Marked complete'], // not "Completed": the client has not confirmed yet
  disputed: ['frozen', '‖', 'Disputed'],
  closed: ['done', '✓', 'Closed'],
  declined: ['ended', '×', 'Declined'],
  cancelled: ['ended', '—', 'Cancelled'],
};
export const family = (s: JobStatus) => STATUS[s][0];
export const ENDED: JobStatus[] = ['declined', 'cancelled', 'closed'];

export function Pill({ status }: { status: JobStatus }) {
  const [fam, glyph, label] = STATUS[status];
  return <span className="pill" data-fam={fam}><span aria-hidden="true">{glyph}</span>{label}</span>;
}

/** What the pro gets and the fee, if all of `amountCents` is released. */
export function projected(amountCents: number) {
  const net = ledgerRows('release', amountCents).find((r) => r.kind === 'release')?.amountCents ?? 0;
  return { net, fee: amountCents - net };
}

/** What a client gets back, and what the cancellation fee keeps, if they cancel an accepted job now. */
export function projectedCancel(amountCents: number) {
  const refund = ledgerRows('cancel', amountCents, 0, 'client').find((r) => r.kind === 'refund')?.amountCents ?? 0;
  return { refund, kept: amountCents - refund };
}

type Row = { kind: LedgerKind; amountCents: number };

/** The escrow box: where the money is now (three cells) and the fee sentence under it. */
export function Money({ status, amountCents, ledger, side, other }: { status: JobStatus; amountCents: number; ledger: Row[]; side: Party; other: string }) {
  const sum = (k: LedgerKind) => ledger.filter((r) => r.kind === k).reduce((s, r) => s + r.amountCents, 0);
  const back = sum('refund'), paid = sum('release'), fee = sum('fee');
  const held = escrow(ledger).inEscrow;
  const p = projected(amountCents);
  const client = side === 'client';
  const pro = client ? 'the pro' : 'you';

  let formula: string;
  if (status === 'requested') {
    formula = client
      ? `Held when ${other} accepts. ${$(amountCents)} = ${$(p.net)} to the pro + ${$(p.fee)} service fee, once released. Nothing is charged if they decline.`
      : `Accepting holds ${$(amountCents)}. ${$(p.net)} to you after the ${$(p.fee)} service fee, once released.`;
  } else if (status === 'disputed') {
    formula = 'An admin decides the split. The 10% service fee applies only to the part released to the pro.';
  } else if (held > 0) {
    formula = client ? `${$(amountCents)} = ${$(p.net)} to the pro + ${$(p.fee)} service fee, once released.` : `${$(p.net)} to you after the ${$(p.fee)} service fee, once released.`;
  } else if (paid && back) {
    formula = `${$(back + paid + fee)} = ${$(back)} refunded to ${client ? 'you' : 'the client'} + ${$(paid)} to ${pro} + ${$(fee)} service fee on the ${$(paid + fee)} released.`;
  } else if (paid) {
    formula = client ? `${$(paid + fee)} = ${$(paid)} to the pro + ${$(fee)} service fee.` : `${$(paid)} to you after the ${$(fee)} service fee.`;
  } else if (back) {
    formula = 'Refunded in full. No service fee.';
  } else {
    formula = 'Nothing was charged.';
  }

  const cell = (label: string, cents: number) => (
    <p data-on={cents > 0 || undefined}><span>{label}</span>{cents > 0 ? $(cents) : '—'}</p>
  );
  return (
    <div className="money">
      <p><span>Job total</span><strong>{$(amountCents)}</strong></p>
      <div className="cells">
        {cell(client ? 'Back to you' : 'Refunded to client', back)}
        {cell(status === 'disputed' ? 'Frozen' : 'Held by Tradepost', held)}
        {cell(client ? 'Paid to the pro' : 'Paid to you', paid)}
      </div>
      <p>{formula}</p>
    </div>
  );
}

/** Whose move it is, in one sentence. */
export function nextMove(status: JobStatus, side: Party, o: { other: string; date: Date; autoAt?: Date; member?: boolean }): [string, string] {
  const auto = o.autoAt ? when(o.autoAt) : 'soon';
  if (side === 'client') {
    return ({
      requested: ['Waiting on', `${o.other} to accept.`],
      accepted: ['Booked.', `${o.other} is coming ${day(o.date)}.`],
      in_progress: ['In progress.', `${o.other} has started the job.`],
      completed: ['Your move.', `Check the work. Confirms automatically ${auto}.`],
      disputed: ['With an admin.', 'The money stays frozen until the dispute is resolved. Nobody can move it before then.'],
      closed: ['Done.', 'The job is closed.'],
      declined: ['Declined.', `${o.other} can’t take this job.`],
      cancelled: ['Cancelled.', 'This job was cancelled.'],
    } as const)[status] as [string, string];
  }
  const mine = o.member ? 'The owner’s move.' : 'Your move.';
  return ({
    requested: [mine, `Accept or decline ${o.other}’s request.`],
    accepted: ['Booked.', `${day(o.date)}. Start the job when you arrive.`],
    in_progress: [mine, 'Mark complete when the work is done.'],
    completed: ['Waiting on', `${o.other} to confirm. Pays out automatically ${auto}.`],
    disputed: ['With an admin.', 'The money is frozen while an admin reviews both statements.'],
    closed: ['Paid out.', 'The job is closed.'],
    declined: ['Declined.', 'You declined this request.'],
    cancelled: ['Cancelled.', 'This job was cancelled.'],
  } as const)[status] as [string, string];
}
