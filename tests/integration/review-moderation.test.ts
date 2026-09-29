import { beforeEach, describe, expect, it } from 'vitest';
import { moderate } from '@/app/admin/reviews/actions';
import { reportReviewOfMe } from '@/app/jobs/actions';
import * as providerActions from '@/app/o/[org]/jobs/actions';
import { now } from '@/core/clock';
import { db } from '@/core/db';
import { Refused } from '@/core/errors';
import { transition } from '@/lib/jobs';
import { reportTheirReview, submitReview } from '@/lib/reviews';
import { clientDb, moderateReview, providerDb, reportedReviews, reviewsVisibleTo } from '@/lib/tenancy';
import { JOB, LISTING } from '../fixtures/app';
import { resetAuthTables, signInAs } from '../helpers/auth';
import { NavSignal } from '../helpers/next';
import { actAs, addMember, makeOrg } from '../helpers/org';

// D-024 (F-16). Provider P (owner u), client C, one closed job J.
let P: Awaited<ReturnType<typeof setup>>;
async function setup() {
  const p = await makeOrg('p');
  const u = await addMember(p.id, 'owner', 'u@example.test');
  const c = await db.user.create({ data: { email: 'c@example.test' } });
  const l = await db.listing.create({ data: { ...LISTING, orgId: p.id, title: 'P plumbing' } });
  const j = await db.job.create({ data: { ...JOB, orgId: p.id, listingId: l.id, clientId: c.id } });
  const ctx = await actAs(u.id, 'p');
  const pro = providerDb(ctx).job;
  const cli = clientDb({ userId: c.id }).job;
  for (const t of ['accept', 'start', 'complete'] as const) await transition(pro, j.id, t, 'provider');
  await transition(cli, j.id, 'confirm', 'client');
  return { p, u, c, j, pro, cli };
}

beforeEach(async () => {
  await resetAuthTables();
  P = await setup();
});

const outcome = (e: unknown) => (e instanceof NavSignal ? e.kind : e instanceof Refused ? e.message : e);
const rating = () => db.providerRating.findUnique({ where: { orgId: P.p.id }, select: { count: true, sum: true } });
const review = (by: 'client' | 'provider') => db.review.findUniqueOrThrow({ where: { jobId_by: { jobId: P.j.id, by } } });
const admin = async () => {
  const a = await db.user.create({ data: { email: 'admin@example.test', totpEnrolledAt: now() } });
  await db.platformAdmin.create({ data: { userId: a.id } });
  return a;
};
const bothReviewed = async () => {
  await submitReview(P.cli, P.j.id, 'client', 1, 'Terrible, and here is his home address');
  await submitReview(P.pro, P.j.id, 'provider', 5, 'Great client');
};

describe('reporting a review (D-024)', () => {
  it('only a published review of the reporter, once; never an unpublished one (blind)', async () => {
    await submitReview(P.cli, P.j.id, 'client', 1, 'Bad');
    await expect(reportTheirReview(P.pro, P.j.id, 'provider', 'x')).rejects.toThrow(/no published review/); // still blind
    await submitReview(P.pro, P.j.id, 'provider', 5, '');
    await expect(reportTheirReview(P.cli, P.j.id, 'client', 'x')).resolves.toBeUndefined(); // the pro's review of C
    await expect(reportTheirReview(P.cli, P.j.id, 'client', 'again')).rejects.toThrow(/already reported/);
    await expect(reportTheirReview(P.pro, P.j.id, 'provider', 'y')).resolves.toBeUndefined(); // C's review of the pro
    expect((await reportedReviews()).map((r) => r.by).sort()).toEqual(['client', 'provider']);
  });

  it("a foreign job is notFound, through each side's action", async () => {
    await bothReviewed();
    const other = await db.user.create({ data: { email: 'o@example.test' } });
    await signInAs(other.id);
    expect(await reportReviewOfMe({ id: P.j.id, reason: 'x' }).catch(outcome)).toBe('notFound');
    const q = await makeOrg('q');
    const v = await addMember(q.id, 'owner', 'v@example.test');
    await actAs(v.id, 'q');
    expect(await providerActions.reportReviewOfUs('q', { id: P.j.id, reason: 'x' }).catch(outcome)).toBe('notFound');
    expect(await reportedReviews()).toEqual([]);
    await actAs(P.u.id, 'p');
    expect(await providerActions.reportReviewOfUs('p', { id: P.j.id, reason: 'Doxxing' }).catch(outcome)).toBe('redirect');
    expect((await review('client')).reportReason).toBe('Doxxing');
  });
});

describe('moderating a report (D-024)', () => {
  it('the action: notFound for a non-admin, MFA required, then hides it, drops its stars and audits', async () => {
    const a = await admin();
    await bothReviewed();
    expect(await rating()).toEqual({ count: 1, sum: 1 });
    await reportTheirReview(P.pro, P.j.id, 'provider', 'Doxxing');
    const input = { reviewId: (await review('client')).id, outcome: 'hide' };
    await signInAs(P.c.id);
    expect(await moderate(input).catch(outcome)).toBe('notFound');
    await signInAs(a.id);
    expect(await moderate(input).catch((e) => (e instanceof NavSignal ? e.to : e))).toBe('/login/mfa');
    await signInAs(a.id, { mfa: true });
    expect(await moderate(input).catch(outcome)).toBe('redirect');
    expect(await rating()).toEqual({ count: 0, sum: 0 });
    expect(await reportedReviews()).toEqual([]);
    expect(await moderate({ ...input, outcome: 'keep' })).toEqual({ error: expect.stringMatching(/already handled/) }); // a racing second admin
    expect(await rating()).toEqual({ count: 0, sum: 0 }); // stars came out once
    const events = await db.auditEvent.findMany({ where: { action: { startsWith: 'review.' } }, select: { action: true, actorUserId: true } });
    expect(events).toEqual([{ action: 'review.hide', actorUserId: a.id }]);
    // Both parties' pages see it as removed.
    const seen = async (side: 'client' | 'provider') =>
      (await (side === 'client' ? P.cli : P.pro).findFirstOrThrow({ where: { id: P.j.id }, include: reviewsVisibleTo(side) })).reviews.find((r) => r.by === 'client');
    expect((await seen('provider'))?.hidden).toBe(true);
    expect((await seen('client'))?.hidden).toBe(true);
  });

  it("keeping it leaves the rating alone; hiding the pro's review of a client never touches the rating", async () => {
    const a = await admin();
    await bothReviewed();
    await reportTheirReview(P.pro, P.j.id, 'provider', 'Unfair');
    await reportTheirReview(P.cli, P.j.id, 'client', 'Unfair too');
    expect(await moderateReview((await review('client')).id, a.id, false)).toBe(true);
    expect(await moderateReview((await review('provider')).id, a.id, true)).toBe(true);
    expect(await rating()).toEqual({ count: 1, sum: 1 });
    expect([(await review('client')).hidden, (await review('provider')).hidden]).toEqual([false, true]);
  });

  it('an unreported review cannot be moderated', async () => {
    const a = await admin();
    await bothReviewed();
    expect(await moderateReview((await review('client')).id, a.id, true)).toBe(false);
    expect(await rating()).toEqual({ count: 1, sum: 1 });
  });
});
