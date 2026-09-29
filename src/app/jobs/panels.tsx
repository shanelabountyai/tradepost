import { now } from '@/core/clock';
import { ActionForm } from '@/core/ui/action-form';
import type { JobStatus, Party } from '@/generated/prisma/enums';
import { REVIEW_WINDOW_MS } from '@/lib/reviews';
import { $, day, ENDED, when } from './card';

// The dispute, review and thread panels, shared by the client's /jobs and the provider's /o/[org]/jobs.
type Act = (form: FormData) => Promise<unknown>;
type Review = { by: Party; stars: number; body: string; publishedAt: Date | null; reportedAt: Date | null; moderatedAt: Date | null; hidden: boolean };

/** P0-6: open a dispute from in progress / completed; while it is open, add or replace a statement. */
export function DisputePanel({ id, status, amountCents, open, add }: { id: string; status: JobStatus; amountCents: number; open: Act; add: Act }) {
  if (status !== 'in_progress' && status !== 'completed' && status !== 'disputed') return null;
  const disputed = status === 'disputed';
  return (
    <details>
      <summary>Dispute <small>{disputed ? 'Open · money frozen' : 'Freezes the money'}</small></summary>
      <ActionForm action={disputed ? add : open}>
        <input type="hidden" name="id" value={id} />
        <label>
          {disputed ? 'Your statement (replaces any earlier one)' : 'Your statement'}
          <textarea name="statement" required maxLength={4000} placeholder="What was agreed, and what went wrong?" />
        </label>
        <p className="hint">
          {disputed
            ? 'Only Tradepost staff read statements. The admin can decide without one.'
            : `Opening a dispute freezes the ${$(amountCents)}. An admin reads both statements and the thread, then returns or splits the money. Only Tradepost staff read statements.`}
        </p>
        <button type="submit" className="danger">{disputed ? 'Save statement' : 'Open a dispute'}</button>
      </ActionForm>
    </details>
  );
}

const starsOf = (n: number) => `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`;

/** P0-5: the caller's own review, the other side's once published, and the form while the window is open. Blind. */
export function ReviewPanel({ id, status, closedAt, visible, party, other, review, report }: {
  id: string; status: JobStatus; closedAt: Date | null; visible: Review[]; party: Party; other: string; review: Act; report: Act;
}) {
  if (status !== 'closed' || !closedAt) {
    if (status === 'declined' || status === 'cancelled') return null;
    return (
      <details>
        <summary>Review <small>After the job closes</small></summary>
        <p className="hint">You can review {other} once the job closes. Reviews are blind: neither side sees the other&apos;s until both are in, or 14 days pass.</p>
      </details>
    );
  }
  const mine = visible.find((r) => r.by === party);
  const theirs = visible.find((r) => r.by !== party);
  const ends = new Date(closedAt.getTime() + REVIEW_WINDOW_MS);
  const quote = (who: string, r: Review) => (
    <div className="quote">
      <h3>{who}</h3>
      <span className="rated" aria-label={`${r.stars} of 5 stars`}>{starsOf(r.stars)}</span>
      {r.body && <p>{r.body}</p>}
    </div>
  );
  const open = now() < ends;
  const meta = theirs ? 'Published' : mine ? 'Waiting on theirs' : open ? 'Blind until both are in' : 'Window closed';
  return (
    <details open={!mine && open}>
      <summary>Review <small>{meta}</small></summary>
      <div className="thread">
        {mine && quote('Your review', mine)}
        {mine?.hidden && <p className="hint">Tradepost moderation removed your review. {other} no longer sees it.</p>}
        {theirs && !theirs.hidden && quote(`${other}’s review`, theirs)}
        {theirs?.hidden && <p className="hint">Tradepost moderation removed {other}&apos;s review after your report.</p>}
        {theirs?.reportedAt && !theirs.hidden && <p className="hint">{theirs.moderatedAt ? 'You reported this review. Tradepost staff reviewed it and kept it up.' : 'You reported this review. Tradepost staff will keep or remove it.'}</p>}
        {theirs && !theirs.reportedAt && (
          <details>
            <summary>Report this review</summary>
            <ActionForm action={report}>
              <input type="hidden" name="id" value={id} />
              <label>What is wrong with it? <textarea name="reason" required maxLength={1000} rows={2} placeholder="Abusive, false, or about someone else" /></label>
              <p className="hint">Tradepost staff read the report and either keep the review or remove it. You can report it once.</p>
              <button type="submit" className="secondary">Send report</button>
            </ActionForm>
          </details>
        )}
        {mine && !theirs && <p className="hint">You&apos;ve reviewed. Theirs appears when they submit, or on {day(ends)}. Yours stays hidden from them until then.</p>}
        {mine && theirs && <p className="hint">Both reviews are published.</p>}
        {!mine && !open && <p className="hint">The 14-day review window closed on {day(ends)}.</p>}
        {!mine && open && (
          <ActionForm action={review}>
            <input type="hidden" name="id" value={id} />
            <fieldset className="stars">
              <legend>Rating</legend>
              {[5, 4, 3, 2, 1].map((n) => (
                <label key={n} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
                  <input type="radio" name="stars" value={n} required />★
                </label>
              ))}
            </fieldset>
            <label>What was it like? <textarea name="body" maxLength={2000} rows={2} /></label>
            <p className="hint">Blind review. {other} sees yours only after they submit theirs, or on {day(ends)}.</p>
            <button type="submit" className="secondary">Submit review</button>
          </ActionForm>
        )}
      </div>
    </details>
  );
}

type Message = { id: string; by: Party; body: string; createdAt: Date };

/** P0-7: the job's thread with the other party, and the form to add to it. Open while there is anything to read. */
export function ThreadPanel({ id, status, messages, party, other, send }: {
  id: string; status: JobStatus; messages: Message[]; party: Party; other: string; send: Act;
}) {
  const over = ENDED.includes(status);
  const n = messages.length;
  return (
    <details open={n > 0 && !over}>
      <summary>Messages <small>{n} message{n === 1 ? '' : 's'}{over && ' · job over'}</small></summary>
      <div className="thread">
        {over && <p className="ended"><span aria-hidden="true">— </span>This job {status === 'closed' ? 'is closed' : `was ${status}`}. Messages are kept for the record.</p>}
        {messages.map((m) => (
          <p key={m.id} className={m.by === party ? 'msg mine' : 'msg'}>
            <span>{m.by === party ? 'You' : other} · {when(m.createdAt)}</span>
            {m.body}
          </p>
        ))}
        <ActionForm action={send}>
          <input type="hidden" name="id" value={id} />
          <label>Message <textarea name="body" required maxLength={4000} rows={2} placeholder={`Write to ${other}`} /></label>
          <button type="submit" className="secondary">Send</button>
          <p className="hint">New messages appear every few seconds. If this job is disputed, Tradepost staff can read this thread.</p>
        </ActionForm>
      </div>
    </details>
  );
}
