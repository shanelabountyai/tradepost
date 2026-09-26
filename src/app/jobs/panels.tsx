import { now } from '@/core/clock';
import { ActionForm } from '@/core/ui/action-form';
import type { JobStatus, Party } from '@/generated/prisma/enums';
import { REVIEW_WINDOW_MS } from '@/lib/reviews';

// The dispute and review blocks, shared by the client's /jobs and the provider's /o/[org]/jobs.
type Act = (form: FormData) => Promise<unknown>;
type Review = { by: Party; stars: number; body: string; publishedAt: Date | null };
const day = (d: Date) => d.toISOString().slice(0, 10);

/** P0-6: open a dispute from in progress / completed; while it is open, add or replace a statement. */
export function DisputePanel({ id, status, open, add }: { id: string; status: JobStatus; open: Act; add: Act }) {
  if (status !== 'in_progress' && status !== 'completed' && status !== 'disputed') return null;
  const disputed = status === 'disputed';
  return (
    <details>
      <summary>{disputed ? 'Payment frozen: Tradepost is reviewing the dispute' : 'Report a problem'}</summary>
      <ActionForm action={disputed ? add : open}>
        <input type="hidden" name="id" value={id} />
        <label>
          {disputed ? 'Your statement (replaces any earlier one)' : 'What went wrong?'}{' '}
          <textarea name="statement" required maxLength={4000} />
        </label>
        <p>Only Tradepost staff read statements.</p>
        <button type="submit">{disputed ? 'Save statement' : 'Open a dispute (freezes payment)'}</button>
      </ActionForm>
    </details>
  );
}

/** P0-5: the caller's own review, the other side's once published, and the form while the window is open. */
export function ReviewPanel({ id, status, closedAt, visible, party, review }: {
  id: string; status: JobStatus; closedAt: Date | null; visible: Review[]; party: Party; review: Act;
}) {
  if (status !== 'closed' || !closedAt) return null;
  const mine = visible.find((r) => r.by === party);
  const theirs = visible.find((r) => r.by !== party);
  const ends = new Date(closedAt.getTime() + REVIEW_WINDOW_MS);
  const show = (r: Review) => `${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}${r.body ? ` "${r.body}"` : ''}`;
  return (
    <div>
      {mine && <p>Your review: {show(mine)} {mine.publishedAt ? '(published)' : `(hidden until they review, or ${day(ends)})`}</p>}
      {theirs && <p>Their review: {show(theirs)}</p>}
      {!mine && now() < ends && (
        <ActionForm action={review}>
          <input type="hidden" name="id" value={id} />
          <label>
            Rating{' '}
            <select name="stars" defaultValue="5">
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>{' '}
          <label>Review <textarea name="body" maxLength={2000} /></label>
          <p>Neither side sees the other&apos;s review until both are in, or until {day(ends)}.</p>
          <button type="submit">Submit review</button>
        </ActionForm>
      )}
    </div>
  );
}
