import Link from 'next/link';
import { shortId, when } from '@/app/jobs/card';
import { requireUser } from '@/core/auth/session';
import { ActionForm } from '@/core/ui/action-form';
import { requirePlatformAdmin } from '@/lib/admin';
import { reportedReviews } from '@/lib/tenancy';
import { moderate } from './actions';

export const metadata = { title: 'Reported reviews' };

const starsOf = (n: number) => `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`;

// D-024 (F-16): platform admins only. Keeping or hiding is audit-logged; hiding a client's review takes it out of the pro's rating.
export default async function ReportedReviews() {
  const s = await requireUser();
  await requirePlatformAdmin(s);
  const reviews = await reportedReviews();
  return (
    <main>
      <h1>Reported reviews</h1>
      <p className="hint"><Link href="/admin/disputes">Open disputes</Link></p>
      {!reviews.length && (
        <section className="empty">
          <h2>No reported reviews</h2>
          <p>When a client or pro reports a review of them, it waits here for you to keep it or remove it.</p>
        </section>
      )}
      {reviews.map((r) => {
        const author = r.by === 'client' ? r.job.client.email : r.job.org.name;
        const subject = r.by === 'client' ? r.job.org.name : r.job.client.email;
        return (
          <section key={r.id}>
            <div className="top">
              <span className="pill">Reported {when(r.reportedAt!)}</span>
              <code>{shortId(r.jobId)}</code>
            </div>
            <h2>{r.job.listing.title}</h2>
            <p className="sub">Review by {author} ({r.by}) · reported by {subject}</p>
            <div className="statements">
              <div className="quote">
                <h3>The review</h3>
                <span className="rated" aria-label={`${r.stars} of 5 stars`}>{starsOf(r.stars)}</span>
                <p>{r.body || 'No text, stars only.'}</p>
              </div>
              <div className="quote"><h3>The report</h3><p>{r.reportReason}</p></div>
            </div>
            <div className="actions">
              {([['hide', 'Remove the review', 'danger'], ['keep', 'Keep it up', 'secondary']] as const).map(([outcome, label, cls]) => (
                <ActionForm key={outcome} action={moderate}>
                  <input type="hidden" name="reviewId" value={r.id} />
                  <input type="hidden" name="outcome" value={outcome} />
                  <button type="submit" className={cls}>{label}</button>
                </ActionForm>
              ))}
            </div>
            {r.by === 'client' && <p className="hint">Removing it also takes its {r.stars} stars out of {r.job.org.name}&apos;s rating.</p>}
          </section>
        );
      })}
    </main>
  );
}
