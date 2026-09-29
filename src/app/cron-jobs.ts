import { drainOutbox, sweepOutbox } from '@/modules/notifications/outbox'; // notifications
import { autoConfirmDue } from '@/lib/jobs';
import { publishDueReviews } from '@/lib/reviews';
import { matchNewSavedSearches } from '@/lib/saved-searches';

// Clone-owned (plan §3.2): /api/cron calls this after its own core sweeps. A clone adds its jobs here,
// and removing the notifications module deletes the lines marked `// notifications`.
export async function cronJobs(): Promise<Record<string, unknown>> {
  const jobs: Record<string, unknown> = {};
  jobs.outbox = { ...(await drainOutbox()), swept: await sweepOutbox() }; // notifications
  jobs.autoConfirm = await autoConfirmDue(); // P0-3: release escrow 72h after completion
  jobs.reviews = await publishDueReviews(); // P0-5: publish reviews 14d after close
  jobs.savedSearches = await matchNewSavedSearches(); // P1 (F-20): email new-listing matches
  return jobs;
}
