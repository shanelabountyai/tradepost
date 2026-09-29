import Link from 'next/link';
import { can } from '@/core/authz/permissions';
import { requireOrg } from '@/core/authz/guards';
import { db } from '@/core/db';
import { providerDb } from '@/lib/tenancy';

// Navigation only. Layouts do not re-run on every navigation, so each page calls requireOrg itself.
export default async function OrgLayout({ children, params }: { children: React.ReactNode; params: Promise<{ org: string }> }) {
  const ctx = await requireOrg((await params).org);
  const [org, pending] = await Promise.all([
    db.org.findUniqueOrThrow({ where: { id: ctx.orgId }, select: { name: true } }),
    providerDb(ctx).job.count({ where: { status: 'requested' } }),
  ]);
  const base = `/o/${ctx.slug}`;
  return (
    <>
      <nav aria-label="Business" className="subnav">
        <strong>{org.name}</strong><Link href={base}>Home</Link>
        <Link href={`${base}/jobs`}>Jobs{pending > 0 && ` (${pending})`}</Link>
        <Link href={`${base}/listings`}>Listings</Link><Link href={`${base}/earnings`}>Earnings</Link><Link href={`${base}/settings/members`}>Members</Link>
        <Link href={`${base}/settings/contact`}>Contact number</Link>
        {can(ctx.role, 'billing.manage') && <Link href={`${base}/settings/billing`}>Billing</Link>} {/* billing */}
        {can(ctx.role, 'org.delete') && <Link href={`${base}/settings/danger`}>Delete org</Link>}
      </nav>
      {children}
    </>
  );
}
