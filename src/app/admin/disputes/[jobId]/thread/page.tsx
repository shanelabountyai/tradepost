import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePlatformAdmin } from '@/lib/admin';
import { adminReadThread } from '@/lib/threads';

export const metadata = { title: 'Dispute case' };

const $ = (cents: number) => (cents / 100).toFixed(2);
const at = (d: Date) => `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// P0-7, F-05: a platform admin reads a disputed job's thread, open or resolved. Each render is one audited read,
// which is why the case has its own page rather than sitting on /admin/disputes.
export default async function Thread({ params }: { params: Promise<{ jobId: string }> }) {
  const admin = await requirePlatformAdmin();
  const { jobId } = await params;
  if (!UUID.test(jobId)) notFound();
  const job = await adminReadThread(jobId, admin.userId);
  const d = job.dispute!; // the query requires one
  return (
    <main>
      <p><Link href="/admin/disputes">Back to disputes</Link></p>
      <h1>Dispute: {job.listing.title}</h1>
      <p>This read is recorded in the audit log.</p>
      <p>{job.org.name} · {job.client.email} · ${$(job.amountCents)} · opened by the {d.openedBy} {at(d.openedAt)}</p>
      {d.resolvedAt ? (
        <p><strong>Resolved</strong> {at(d.resolvedAt)}: ${$(d.refundCents ?? 0)} refunded to the client, the rest released to the pro less the fee.</p>
      ) : (
        <p><strong>Open</strong>, funds frozen.</p>
      )}
      <h2>Client statement</h2>
      <p>{d.clientStatement ?? 'None.'}</p>
      <h2>Provider statement</h2>
      <p>{d.providerStatement ?? 'None.'}</p>
      <h2>Thread</h2>
      {!job.messages.length && <p>No messages.</p>}
      {job.messages.map((m) => (
        <p key={m.id}><strong>{m.by === 'client' ? 'Client' : 'Pro'}</strong> · {m.createdAt.toISOString().slice(0, 16).replace('T', ' ')} UTC<br />{m.body}</p>
      ))}
    </main>
  );
}
