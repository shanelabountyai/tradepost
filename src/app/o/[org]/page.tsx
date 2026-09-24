import Link from 'next/link';
import { requireOrg } from '@/core/authz/guards';

// The clone replaces this page with its own home. It stays a guarded empty state until then.
export default async function OrgHome({ params }: { params: Promise<{ org: string }> }) {
  const ctx = await requireOrg((await params).org);
  return (
    <main>
      <h1>Nothing here yet</h1>
      <p>This org is ready. <Link href={`/o/${ctx.slug}/settings/members`}>Invite your team</Link> to get started.</p>
    </main>
  );
}
