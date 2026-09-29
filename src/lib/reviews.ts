import { notFound } from 'next/navigation';
import { now } from '@/core/clock';
import { Refused } from '@/core/errors';
import type { Party } from '@/generated/prisma/enums';
import { publishReviews, reportReview, reviewsDue, type providerDb } from '@/lib/tenancy';

// P0-5: blind mutual reviews. Written through the caller's scoped job client, so a foreign job is
// notFound; read only through reviewsVisibleTo (src/lib/tenancy.ts), which hides the other party's
// review until it is published.

export const REVIEW_WINDOW_MS = 14 * 86_400_000;

type Jobs = ReturnType<typeof providerDb>['job'];

export async function submitReview(jobs: Jobs, id: string, by: Party, stars: number, body: string) {
  const job = await jobs.findFirst({ where: { id }, select: { status: true, closedAt: true } });
  if (!job) notFound();
  if (job.status !== 'closed' || !job.closedAt) throw new Refused('You can review a job once it is closed.');
  if (now().getTime() >= job.closedAt.getTime() + REVIEW_WINDOW_MS) throw new Refused('The 14-day review window has ended.');
  await jobs.update({ where: { id }, data: { reviews: { create: { by, stars, body, createdAt: now() } } } }).catch((e) => {
    if (e?.code === 'P2002') throw new Refused('You have already reviewed this job.');
    throw e;
  });
  await publishReviews(id, true);
}

/** Cron (P0-5): publishes whatever was submitted once a job's 14-day window has ended. */
export async function publishDueReviews() {
  const due = await reviewsDue(new Date(now().getTime() - REVIEW_WINDOW_MS));
  for (const j of due) await publishReviews(j.id, false);
  return { published: due.length };
}

/** D-024 (F-16): `by` reports the other party's published review of them; a platform admin then keeps or hides it. */
export async function reportTheirReview(jobs: Jobs, id: string, by: Party, reason: string) {
  if (!(await jobs.findFirst({ where: { id }, select: { id: true } }))) notFound();
  if (!(await reportReview(id, by === 'client' ? 'provider' : 'client', reason))) throw new Refused('There is no published review here to report, or it is already reported.');
}
