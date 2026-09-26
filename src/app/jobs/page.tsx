import Link from 'next/link';
import { requireUser } from '@/core/auth/session';
import { ActionForm } from '@/core/ui/action-form';
import { AUTO_CONFIRM_MS, escrow } from '@/lib/jobs';
import { clientDb, reviewsVisibleTo } from '@/lib/tenancy';
import { addStatement, cancelJob, confirmJob, disputeJob, reviewPro, withdrawJob } from './actions';
import { DisputePanel, ReviewPanel } from './panels';

export const metadata = { title: 'Your bookings' };

const $ = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// P0-3: a client's own jobs. Confirming releases the held payment to the pro.
export default async function Bookings() {
  const s = await requireUser();
  const jobs = await clientDb(s).job.findMany({
    orderBy: { createdAt: 'desc' },
    include: { listing: { select: { title: true } }, org: { select: { name: true } }, ledger: true, ...reviewsVisibleTo('client') },
  });
  const moves = {
    requested: [[withdrawJob, 'Withdraw request']],
    accepted: [[cancelJob, 'Cancel (full refund)']],
    completed: [[confirmJob, 'Confirm the work is done (releases payment)']],
  } as const;

  return (
    <main>
      <h1>Your bookings</h1>
      <p><Link href="/search">Find a pro</Link></p>
      {!jobs.length && <p>No bookings yet.</p>}
      {jobs.map((j) => {
        const e = escrow(j.ledger);
        return (
          <section key={j.id}>
            <h2>{j.listing.title} · {j.org.name} · {j.date.toISOString().slice(0, 10)}</h2>
            <p>
              {$(j.amountCents)} · <strong>{j.status.replace('_', ' ')}</strong>
              {e.inEscrow > 0 && <> · {$(e.inEscrow)} held by Tradepost</>}
              {j.ledger.filter((r) => r.kind === 'refund').map((r) => <span key={r.id}> · {$(r.amountCents)} refunded</span>)}
              {j.ledger.filter((r) => r.kind === 'release').map((r) => <span key={r.id}> · {$(r.amountCents)} paid to the pro</span>)}
            </p>
            {j.status === 'completed' && j.completedAt && (
              <p>Confirms automatically {new Date(j.completedAt.getTime() + AUTO_CONFIRM_MS).toISOString().slice(0, 16).replace('T', ' ')} UTC.</p>
            )}
            {(moves[j.status as keyof typeof moves] ?? []).map(([action, label]) => (
              <ActionForm key={label} action={action}>
                <input type="hidden" name="id" value={j.id} />
                <button type="submit">{label}</button>
              </ActionForm>
            ))}
            <DisputePanel id={j.id} status={j.status} open={disputeJob} add={addStatement} />
            <ReviewPanel id={j.id} status={j.status} closedAt={j.closedAt} visible={j.reviews} party="client" review={reviewPro} />
          </section>
        );
      })}
    </main>
  );
}
