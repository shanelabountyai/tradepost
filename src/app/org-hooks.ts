import { cancelOrgSubscription } from '@/modules/billing/provider'; // billing
import { Refused } from '@/core/errors';
import { providerDb } from '@/lib/tenancy';

// Clone-owned, like cron-jobs.ts: what must happen before an org is deleted. Throwing stops the
// deletion. Removing the billing module deletes the lines marked `// billing`.
// FR-05: a deleted org must not keep charging.
export async function beforeOrgDelete(orgId: string): Promise<void> {
  // D-012: a provider with jobs has money history, which the database refuses to delete (D-004). Refuse
  // here first, or the subscription below is cancelled and then the delete fails, leaving the org unbilled.
  if (await providerDb({ orgId }).job.count()) throw new Refused('This provider has jobs on record, so it cannot be deleted.');
  await cancelOrgSubscription(orgId); // billing
}
