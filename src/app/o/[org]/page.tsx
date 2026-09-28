import Link from 'next/link';
import { requireOrg } from '@/core/authz/guards';
import { $ } from '@/app/jobs/card';
import { providerDb, providerLedgerTotals } from '@/lib/tenancy';

const NEEDS_ACTION = ['requested', 'accepted', 'in_progress'] as const;

// The provider's landing page: what needs them right now, not a generic empty state.
export default async function OrgHome({ params }: { params: Promise<{ org: string }> }) {
  const ctx = await requireOrg((await params).org);
  const [needsAction, listingCount, ledger] = await Promise.all([
    providerDb(ctx).job.count({ where: { status: { in: [...NEEDS_ACTION] } } }),
    providerDb(ctx).listing.count(),
    providerLedgerTotals(ctx.orgId),
  ]);

  return (
    <main>
      <h1>{needsAction > 0 ? `${needsAction} job${needsAction === 1 ? '' : 's'} need your attention` : "You're all caught up"}</h1>
      <div className="cells">
        <p data-on={needsAction > 0 || undefined}><span>Needs your action</span><Link href={`/o/${ctx.slug}/jobs`}>{needsAction}</Link></p>
        <p data-on={listingCount > 0 || undefined}><span>Active listings</span><Link href={`/o/${ctx.slug}/listings`}>{listingCount}</Link></p>
        <p data-on={ledger.held > 0 || undefined}><span>Held in escrow</span><Link href={`/o/${ctx.slug}/earnings`}>{$(ledger.held)}</Link></p>
      </div>
      {listingCount === 0 && <p><Link href={`/o/${ctx.slug}/listings`}>Add your first listing</Link> so clients can find you.</p>}
    </main>
  );
}
