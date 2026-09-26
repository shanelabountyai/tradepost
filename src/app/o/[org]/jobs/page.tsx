import { requireOrg } from '@/core/authz/guards';
import { ActionForm } from '@/core/ui/action-form';
import { AUTO_CONFIRM_MS, escrow } from '@/lib/jobs';
import { providerDb } from '@/lib/tenancy';
import { acceptJob, cancelJobAsProvider, completeJob, declineJob, startJob } from './actions';

export const metadata = { title: 'Jobs' };

const $ = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// P0-3: a provider's own jobs and the moves open to it. Payment is released by the client or the 72h auto-confirm.
export default async function Jobs({ params }: { params: Promise<{ org: string }> }) {
  const ctx = await requireOrg((await params).org);
  const jobs = await providerDb(ctx).job.findMany({
    orderBy: { createdAt: 'desc' },
    include: { listing: { select: { title: true } }, client: { select: { email: true } }, ledger: true },
  });
  const moves = { requested: [[acceptJob, 'Accept'], [declineJob, 'Decline']], accepted: [[startJob, 'Start'], [cancelJobAsProvider, 'Cancel and refund']], in_progress: [[completeJob, 'Mark complete']] } as const;

  return (
    <main>
      <h1>Jobs</h1>
      {!jobs.length && <p>No requests yet.</p>}
      {jobs.map((j) => {
        const e = escrow(j.ledger);
        return (
          <section key={j.id}>
            <h2>{j.listing.title} · {j.date.toISOString().slice(0, 10)}</h2>
            <p>
              {j.client.email} · {$(j.amountCents)} · <strong>{j.status.replace('_', ' ')}</strong>
              {e.inEscrow > 0 && <> · {$(e.inEscrow)} held</>}
              {j.ledger.filter((r) => r.kind === 'release').map((r) => <span key={r.id}> · {$(r.amountCents)} paid to you</span>)}
            </p>
            {j.status === 'completed' && j.completedAt && (
              <p>Waiting for the client. Auto-confirms {new Date(j.completedAt.getTime() + AUTO_CONFIRM_MS).toISOString().slice(0, 16).replace('T', ' ')} UTC.</p>
            )}
            {(moves[j.status as keyof typeof moves] ?? []).map(([action, label]) => (
              <ActionForm key={label} action={action.bind(null, ctx.slug)}>
                <input type="hidden" name="id" value={j.id} />
                <button type="submit">{label}</button>
              </ActionForm>
            ))}
          </section>
        );
      })}
    </main>
  );
}
