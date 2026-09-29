import Link from 'next/link';
import { $, day, projected, shortId, when } from '@/app/jobs/card';
import { ActionForm } from '@/core/ui/action-form';
import { requireUser } from '@/core/auth/session';
import { requirePlatformAdmin } from '@/lib/admin';
import { openDisputes, resolvedDisputes } from '@/lib/tenancy';
import { resolveDispute } from './actions';

export const metadata = { title: 'Disputes' };

const dollars = (cents: number) => (cents / 100).toFixed(2);

/** How a resolution splits `amount` given `refund`, from the same ledgerRows() the resolution writes. */
function splitText(amount: number, refund: number) {
  if (refund >= amount) return 'Full refund · no fee';
  const { net, fee } = projected(amount - refund);
  return refund ? `Split · ${$(refund)} refunded · ${$(net)} to pro · ${$(fee)} fee` : `Full release · ${$(net)} to pro · ${$(fee)} fee`;
}

// P0-6 (D-005): platform admins only. Statements are shown here and on the audited case page, nowhere else.
export default async function Disputes() {
  const s = await requireUser();
  await requirePlatformAdmin(s);
  const [jobs, resolved] = await Promise.all([openDisputes(), resolvedDisputes()]);
  return (
    <main>
      <h1>Open disputes</h1>
      <p className="hint"><Link href="/admin/reviews">Reported reviews</Link></p>
      {!jobs.length && (
        <section className="empty">
          <h2>No open disputes</h2>
          <p>Nothing is frozen right now. Resolved cases are listed below.</p>
        </section>
      )}
      {jobs.map((j) => {
        const d = j.dispute;
        return (
          <section key={j.id} data-fam="frozen">
            <div className="top">
              <span className="pill"><span aria-hidden="true">‖</span>{$(j.amountCents)} frozen</span>
              <code>{shortId(j.id)}</code>
            </div>
            <h2>{j.listing.title}</h2>
            <p className="sub">{j.client.email} · {j.org.name} · {day(j.date)} · opened by the {d?.openedBy} {d && when(d.openedAt)}</p>
            <div className="statements">
              <div className="quote"><h3>Client statement</h3><p>{d?.clientStatement ?? 'None yet.'}</p></div>
              <div className="quote"><h3>Provider statement</h3><p>{d?.providerStatement ?? 'None yet.'}</p></div>
            </div>
            <p><Link href={`/admin/disputes/${j.id}/thread`}>Read the message thread</Link> <small>Each read is recorded in the audit log.</small></p>
            <ActionForm action={resolveDispute}>
              <input type="hidden" name="jobId" value={j.id} />
              <div className="actions split">
                <label>Refund to client ($)<input name="refund" inputMode="decimal" required pattern="\d+(\.\d{1,2})?" placeholder="0.00" /></label>
                <button type="submit">Resolve with split</button>
              </div>
              <p className="hint">The rest is released to the pro, less the 10% service fee on the released part.</p>
            </ActionForm>
            <div className="actions">
              {[[`Full refund · ${$(j.amountCents)} to client`, dollars(j.amountCents)], [`Full release · ${$(projected(j.amountCents).net)} to pro`, '0']].map(([label, refund]) => (
                <ActionForm key={refund} action={resolveDispute}>
                  <input type="hidden" name="jobId" value={j.id} />
                  <input type="hidden" name="refund" value={refund} />
                  <button type="submit" className="secondary">{label}</button>
                </ActionForm>
              ))}
            </div>
          </section>
        );
      })}
      <h2>Resolved</h2>
      {!resolved.length ? <p className="hint">None yet.</p> : (
        <ul className="resolved">
          {resolved.map((r) => (
            <li key={r.jobId}>
              <span><Link href={`/admin/disputes/${r.jobId}/thread`}>{shortId(r.jobId)} · {r.job.listing.title}</Link> · {$(r.job.amountCents)}</span>
              <small>{r.job.client.email} · {r.job.org.name} · {splitText(r.job.amountCents, r.refundCents ?? 0)} · resolved {day(r.resolvedAt!)}</small>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">Opening a resolved case shows its statements and thread, and is recorded in the audit log.</p>
    </main>
  );
}
