import { requireOrg } from '@/core/authz/guards';
import { ActionForm } from '@/core/ui/action-form';
import { $, day, family, Money, nextMove, Pill, shortId } from '@/app/jobs/card';
import { DisputePanel, ReviewPanel, ThreadPanel } from '@/app/jobs/panels';
import { Poll } from '@/app/jobs/poll';
import { AUTO_CONFIRM_MS } from '@/lib/jobs';
import { canManage } from '@/lib/roles';
import { providerDb, reviewsVisibleTo } from '@/lib/tenancy';
import { THREAD } from '@/lib/threads';
import {
  acceptJob, addStatementAsProvider, cancelJobAsProvider, completeJob, declineJob, disputeJobAsProvider, reviewClient, sendMessageAsProvider, startJob,
} from './actions';

export const metadata = { title: 'Jobs' };

// P0-3: a provider's own jobs and the moves open to it. Payment is released by the client or the 72h auto-confirm,
// so no button here ever reads as releasing money.
export default async function Jobs({ params }: { params: Promise<{ org: string }> }) {
  const ctx = await requireOrg((await params).org);
  const jobs = await providerDb(ctx).job.findMany({
    orderBy: { createdAt: 'desc' },
    include: { listing: { select: { title: true } }, client: { select: { email: true } }, ledger: true, messages: THREAD, ...reviewsVisibleTo('provider') },
  });
  const manage = canManage(ctx); // D-009: a member sees jobs and messages, nothing else
  const moves = {
    requested: [[acceptJob, 'Accept', undefined], [declineJob, 'Decline', 'secondary']],
    accepted: [[startJob, 'Start', undefined], [cancelJobAsProvider, 'Cancel and refund', 'secondary']],
    in_progress: [[completeJob, 'Mark complete', undefined]],
  } as const;

  return (
    <main>
      <h1>Jobs</h1>
      <Poll />
      {!manage && <p className="note">You can view jobs and message clients. The owner accepts, completes and disputes jobs.</p>}
      {!jobs.length && (
        <section className="empty">
          <h2>No requests yet</h2>
          <p>When a client requests one of your listings, it shows up here.</p>
        </section>
      )}
      {jobs.map((j) => {
        const client = j.client.email;
        const autoAt = j.completedAt ? new Date(j.completedAt.getTime() + AUTO_CONFIRM_MS) : undefined;
        const [lead, text] = nextMove(j.status, 'provider', { other: client, date: j.date, autoAt, member: !manage });
        return (
          <section key={j.id} data-fam={family(j.status)}>
            <div className="top"><Pill status={j.status} /><code>{shortId(j.id)}</code></div>
            <h2>{j.listing.title}</h2>
            <p className="sub">{client} · {day(j.date)} · {$(j.amountCents)}</p>
            <Money status={j.status} amountCents={j.amountCents} ledger={j.ledger} side="provider" other={client} />
            <p><strong>{lead}</strong> {text}</p>
            {manage && (
              <div className="actions">
                {(moves[j.status as keyof typeof moves] ?? []).map(([action, label, cls]) => (
                  <ActionForm key={label} action={action.bind(null, ctx.slug)}>
                    <input type="hidden" name="id" value={j.id} />
                    <button type="submit" className={cls}>{label}</button>
                  </ActionForm>
                ))}
              </div>
            )}
            {manage && <DisputePanel id={j.id} status={j.status} amountCents={j.amountCents} open={disputeJobAsProvider.bind(null, ctx.slug)} add={addStatementAsProvider.bind(null, ctx.slug)} />}
            {manage && <ReviewPanel id={j.id} status={j.status} closedAt={j.closedAt} visible={j.reviews} party="provider" other={client} review={reviewClient.bind(null, ctx.slug)} />}
            <ThreadPanel id={j.id} status={j.status} messages={j.messages} party="provider" other={client} send={sendMessageAsProvider.bind(null, ctx.slug)} />
          </section>
        );
      })}
    </main>
  );
}
