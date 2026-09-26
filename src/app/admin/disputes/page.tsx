import Link from 'next/link';
import { ActionForm } from '@/core/ui/action-form';
import { requirePlatformAdmin } from '@/lib/admin';
import { openDisputes } from '@/lib/tenancy';
import { resolveDispute } from './actions';

export const metadata = { title: 'Disputes' };

const $ = (cents: number) => (cents / 100).toFixed(2);

// P0-6 (D-005): platform admins only. Statements are shown here and nowhere else.
export default async function Disputes() {
  await requirePlatformAdmin();
  const jobs = await openDisputes();
  return (
    <main>
      <h1>Open disputes</h1>
      {!jobs.length && <p>No open disputes.</p>}
      {jobs.map((j) => (
        <section key={j.id}>
          <h2>{j.listing.title} · {j.org.name} · {j.client.email} · {j.date.toISOString().slice(0, 10)}</h2>
          <p>${$(j.amountCents)} frozen · opened by the {j.dispute?.openedBy} {j.dispute?.openedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC</p>
          <h3>Client statement</h3>
          <p>{j.dispute?.clientStatement ?? 'None yet.'}</p>
          <h3>Provider statement</h3>
          <p>{j.dispute?.providerStatement ?? 'None yet.'}</p>
          <p><Link href={`/admin/disputes/${j.id}/thread`}>Read the message thread</Link> (each read is audit-logged)</p>
          {[['Full refund to the client', $(j.amountCents)], ['Full release to the provider', '0']].map(([label, refund]) => (
            <ActionForm key={label} action={resolveDispute}>
              <input type="hidden" name="jobId" value={j.id} />
              <input type="hidden" name="refund" value={refund} />
              <button type="submit">{label}</button>
            </ActionForm>
          ))}
          <ActionForm action={resolveDispute}>
            <input type="hidden" name="jobId" value={j.id} />
            <label>Split: refund $<input name="refund" inputMode="decimal" required pattern="\d+(\.\d{1,2})?" /></label>{' '}
            <button type="submit">Resolve with split</button>
            <p>The rest is released to the provider, less the 10% fee.</p>
          </ActionForm>
        </section>
      ))}
    </main>
  );
}
