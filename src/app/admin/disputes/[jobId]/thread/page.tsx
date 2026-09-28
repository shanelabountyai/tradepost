import Link from 'next/link';
import { notFound } from 'next/navigation';
import { $, projected, shortId, when } from '@/app/jobs/card';
import { requirePlatformAdmin } from '@/lib/admin';
import { adminReadThread } from '@/lib/threads';

export const metadata = { title: 'Dispute case' };


const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// P0-7, F-05: a platform admin reads a disputed job's thread, open or resolved. Each render is one audited read,
// which is why the case has its own page rather than sitting on /admin/disputes.
export default async function Thread({ params }: { params: Promise<{ jobId: string }> }) {
  const admin = await requirePlatformAdmin();
  const { jobId } = await params;
  if (!UUID.test(jobId)) notFound();
  const job = await adminReadThread(jobId, admin.userId);
  const d = job.dispute!; // the query requires one
  const refund = d.refundCents ?? 0;
  const { net, fee } = projected(job.amountCents - refund);
  const resolvedText = refund >= job.amountCents
    ? 'Full refund to the client, no fee.'
    : `${$(refund)} refunded to the client · ${$(net)} to the pro · ${$(fee)} service fee.`;
  return (
    <main>
      <p><Link href="/admin/disputes">← Back to disputes</Link></p>
      <p className="note">This read is recorded in the audit log.</p>
      <section data-fam={d.resolvedAt ? 'done' : 'frozen'}>
        <div className="top">
          <span className="pill"><span aria-hidden="true">{d.resolvedAt ? '✓' : '‖'}</span>{d.resolvedAt ? 'Resolved' : 'Open · money frozen'}</span>
          <code>{shortId(jobId)}</code>
        </div>
        <h1>{job.listing.title}</h1>
        <p className="sub">{job.client.email} · {job.org.name} · {$(job.amountCents)} · opened by the {d.openedBy} {when(d.openedAt)}</p>
        {d.resolvedAt ? <p><strong>Resolved {when(d.resolvedAt)}.</strong> {resolvedText}</p> : <p><strong>Open.</strong> The {$(job.amountCents)} stays frozen until an admin resolves it.</p>}
        <div className="statements">
          <div className="quote"><h3>Client statement</h3><p>{d.clientStatement ?? 'None.'}</p></div>
          <div className="quote"><h3>Provider statement</h3><p>{d.providerStatement ?? 'None.'}</p></div>
        </div>
      </section>
      <h2>Thread</h2>
      <div className="thread">
        {!job.messages.length && <p className="hint">No messages.</p>}
        {job.messages.map((m) => (
          <p key={m.id} className={m.by === 'provider' ? 'msg mine' : 'msg'}>
            <span>{m.by === 'client' ? job.client.email : job.org.name} · {when(m.createdAt)}</span>
            {m.body}
          </p>
        ))}
      </div>
    </main>
  );
}
