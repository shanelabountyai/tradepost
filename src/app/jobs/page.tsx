import Link from 'next/link';
import { requireUser } from '@/core/auth/session';
import { ActionForm } from '@/core/ui/action-form';
import { AUTO_CONFIRM_MS } from '@/lib/jobs';
import { clientDb, reviewsVisibleTo } from '@/lib/tenancy';
import { THREAD } from '@/lib/threads';
import { addStatement, cancelJob, confirmJob, disputeJob, reviewPro, sendMessage, withdrawJob } from './actions';
import { $, day, family, Money, nextMove, Pill, projected, shortId } from './card';
import { DisputePanel, ReviewPanel, ThreadPanel } from './panels';
import { Poll } from './poll';

export const metadata = { title: 'Your bookings' };

// P0-3: a client's own jobs. Confirming releases the held payment to the pro.
export default async function Bookings() {
  const s = await requireUser();
  const jobs = await clientDb(s).job.findMany({
    orderBy: { createdAt: 'desc' },
    include: { listing: { select: { title: true } }, org: { select: { name: true } }, ledger: true, messages: THREAD, ...reviewsVisibleTo('client') },
  });

  return (
    <main>
      <h1>Your bookings</h1>
      <Poll />
      {!jobs.length && (
        <section className="empty">
          <h2>No bookings yet</h2>
          <p>When you request a pro, the job and its payment show up here.</p>
          <Link className="button" href="/search">Find a pro</Link>
        </section>
      )}
      {jobs.map((j) => {
        const pro = j.org.name;
        const autoAt = j.completedAt ? new Date(j.completedAt.getTime() + AUTO_CONFIRM_MS) : undefined;
        const [lead, text] = nextMove(j.status, 'client', { other: pro, date: j.date, autoAt });
        const move = (action: typeof withdrawJob, label: React.ReactNode, cls?: string) => (
          <ActionForm action={action}>
            <input type="hidden" name="id" value={j.id} />
            <button type="submit" className={cls}>{label}</button>
          </ActionForm>
        );
        return (
          <section key={j.id} data-fam={family(j.status)}>
            <div className="top"><Pill status={j.status} /><code>{shortId(j.id)}</code></div>
            <h2>{j.listing.title}</h2>
            <p className="sub">{pro} · {day(j.date)}</p>
            <Money status={j.status} amountCents={j.amountCents} ledger={j.ledger} side="client" other={pro} />
            <p><strong>{lead}</strong> {text}</p>
            <div className="actions">
              {j.status === 'requested' && move(withdrawJob, 'Withdraw request', 'secondary')}
              {j.status === 'accepted' && move(cancelJob, 'Cancel (full refund)', 'secondary')}
              {j.status === 'completed' && move(confirmJob, <>Confirm the work is done<small>Releases {$(projected(j.amountCents).net)} to the pro</small></>)}
              {j.status === 'declined' && <Link className="button secondary" href="/search">Find another pro</Link>}
            </div>
            <DisputePanel id={j.id} status={j.status} amountCents={j.amountCents} open={disputeJob} add={addStatement} />
            <ReviewPanel id={j.id} status={j.status} closedAt={j.closedAt} visible={j.reviews} party="client" other={pro} review={reviewPro} />
            <ThreadPanel id={j.id} status={j.status} messages={j.messages} party="client" other={pro} send={sendMessage} />
          </section>
        );
      })}
    </main>
  );
}
