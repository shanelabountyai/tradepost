import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePlatformAdmin } from '@/lib/admin';
import { adminReadThread } from '@/lib/threads';

export const metadata = { title: 'Dispute thread' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// P0-7: a platform admin reads a job's thread only while it is disputed. Each render is one audited read,
// which is why the thread has its own page rather than sitting on /admin/disputes.
export default async function Thread({ params }: { params: Promise<{ jobId: string }> }) {
  const admin = await requirePlatformAdmin();
  const { jobId } = await params;
  if (!UUID.test(jobId)) notFound();
  const job = await adminReadThread(jobId, admin.userId);
  return (
    <main>
      <p><Link href="/admin/disputes">Back to disputes</Link></p>
      <h1>Thread: {job.listing.title}</h1>
      <p>This read is recorded in the audit log.</p>
      {!job.messages.length && <p>No messages.</p>}
      {job.messages.map((m) => (
        <p key={m.id}><strong>{m.by === 'client' ? 'Client' : 'Pro'}</strong> · {m.createdAt.toISOString().slice(0, 16).replace('T', ' ')} UTC<br />{m.body}</p>
      ))}
    </main>
  );
}
