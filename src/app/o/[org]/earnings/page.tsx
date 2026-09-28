import { requireOrg } from '@/core/authz/guards';
import { $ } from '@/app/jobs/card';
import { providerLedgerTotals } from '@/lib/tenancy';

export const metadata = { title: 'Earnings' };

// P1: what a provider is owed and what's already moved, read straight from the escrow ledger
// (P0-4's invariant is tested there; this page only sums it, never recomputes it).
export default async function Earnings({ params }: { params: Promise<{ org: string }> }) {
  const ctx = await requireOrg((await params).org);
  const t = await providerLedgerTotals(ctx.orgId);

  return (
    <main>
      <h1>Earnings</h1>
      <div className="cells">
        <p data-on={t.held > 0 || undefined}><span>Held in escrow</span>{$(t.held)}</p>
        <p data-on={t.released > 0 || undefined}><span>Paid out to you</span>{$(t.released)}</p>
        <p data-on={t.fees > 0 || undefined}><span>Service fees taken</span>{$(t.fees)}</p>
      </div>
      <p className="note">
        Held is money on jobs still in progress or awaiting confirmation — it moves to &quot;Paid out&quot; only when
        the client confirms or the 72-hour auto-confirm passes. See <a href="../jobs">Jobs</a> for the breakdown per job.
        {t.refunded > 0 && ` ${$(t.refunded)} has been refunded to clients across cancelled or disputed jobs.`}
      </p>
    </main>
  );
}
