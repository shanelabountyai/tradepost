import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveDispute } from '@/app/admin/disputes/actions';
import * as providerActions from '@/app/o/[org]/jobs/actions';
import { requestJob, reviewPro } from '@/app/jobs/actions';
import { advanceClock, now } from '@/core/clock';
import { db } from '@/core/db';
import { Refused } from '@/core/errors';
import { AUTO_CONFIRM_MS, autoConfirmDue, escrow, ledgerRows, settleDispute, submitStatement, transition, TRANSITIONS } from '@/lib/jobs';
import { publishDueReviews, REVIEW_WINDOW_MS, submitReview } from '@/lib/reviews';
import { clientDb, openDisputes, providerDb, publishReviews, reviewsVisibleTo } from '@/lib/tenancy';
import { JOB, LISTING } from '../fixtures/app';
import { resetAuthTables, signInAs } from '../helpers/auth';
import { NavSignal } from '../helpers/next';
import { actAs, addMember, makeOrg } from '../helpers/org';

// P0-3/4/5/6. Provider P (member u), client C, and one job J at $85 in `requested`.
let P: Awaited<ReturnType<typeof setup>>;
async function setup() {
  const p = await makeOrg('p');
  const u = await addMember(p.id, 'member', 'u@example.test');
  const c = await db.user.create({ data: { email: 'c@example.test' } });
  const l = await db.listing.create({ data: { ...LISTING, orgId: p.id, title: 'P plumbing' } });
  const j = await db.job.create({ data: { ...JOB, orgId: p.id, listingId: l.id, clientId: c.id } });
  const ctx = await actAs(u.id, 'p');
  return { p, u, c, l, j, pro: providerDb(ctx).job, cli: clientDb({ userId: c.id }).job };
}

beforeEach(async () => {
  await resetAuthTables();
  P = await setup();
});

// The escrow invariant, on every job, after every test: nothing held before acceptance, the hold
// equals the job's amount, and a settled job has paid out exactly what it held.
afterEach(async () => {
  for (const j of await db.job.findMany({ include: { ledger: true } })) {
    const e = escrow(j.ledger);
    const expected = {
      requested: [0, 0], declined: [0, 0], accepted: [j.amountCents, 0], in_progress: [j.amountCents, 0], completed: [j.amountCents, 0],
      closed: [j.amountCents, j.amountCents], disputed: [j.amountCents, 0], cancelled: e.held ? [j.amountCents, j.amountCents] : [0, 0],
    }[j.status];
    expect([e.held, e.out], `job ${j.status}`).toEqual(expected);
  }
});

const run = async (...names: (keyof typeof TRANSITIONS)[]) => {
  for (const n of names) {
    const by = TRANSITIONS[n].by[0];
    await transition(by === 'provider' ? P.pro : P.cli, P.j.id, n, by);
  }
};
const ledger = async () => (await db.ledgerEntry.findMany({ where: { jobId: P.j.id }, orderBy: { kind: 'asc' } })).map((r) => [r.kind, r.amountCents]);
const job = () => db.job.findUniqueOrThrow({ where: { id: P.j.id } });
const outcome = (e: unknown) => (e instanceof NavSignal ? e.kind : e instanceof Refused ? e.message : e);

describe('ledger rows (pure)', () => {
  it('release takes a 10% fee rounded down, and the rows sum to the amount', () => {
    expect(ledgerRows('release', 8500)).toEqual([{ kind: 'release', amountCents: 7650 }, { kind: 'fee', amountCents: 850 }]);
    expect(ledgerRows('release', 8599).reduce((s, r) => s + r.amountCents, 0)).toBe(8599);
    expect(ledgerRows('release', 9)).toEqual([{ kind: 'release', amountCents: 9 }]); // a zero fee writes no row
    expect(ledgerRows(null, 8500)).toEqual([]);
  });

  it('no provider transition releases money', () => {
    const releasers = Object.entries(TRANSITIONS).filter(([, t]) => t.money === 'release');
    expect(releasers.map(([n, t]) => [n, t.by])).toEqual([['confirm', ['client']], ['autoConfirm', ['system']]]);
  });
});

describe('lifecycle', () => {
  it('happy path: accept holds, confirm releases minus the fee, and the job closes', async () => {
    await run('accept');
    expect(await ledger()).toEqual([['hold', 8500]]);
    await run('start', 'complete');
    expect((await job()).completedAt).not.toBeNull();
    await run('confirm');
    expect(await ledger()).toEqual([['hold', 8500], ['release', 7650], ['fee', 850]]);
    expect(await job()).toMatchObject({ status: 'closed', closedAt: expect.any(Date) });
  });

  it('decline and withdraw hold nothing', async () => {
    await run('decline');
    expect(await ledger()).toEqual([]);
    const j2 = await db.job.create({ data: { ...JOB, orgId: P.p.id, listingId: P.l.id, clientId: P.c.id } });
    await transition(P.cli, j2.id, 'withdraw', 'client');
    expect((await db.job.findUniqueOrThrow({ where: { id: j2.id } })).status).toBe('cancelled');
  });

  it('a cancel after acceptance, by either side, refunds the whole hold', async () => {
    await run('accept');
    await transition(P.pro, P.j.id, 'cancel', 'provider');
    expect(await ledger()).toEqual([['hold', 8500], ['refund', 8500]]);
  });

  it('refuses a step from the wrong state, and moves nothing', async () => {
    await expect(transition(P.cli, P.j.id, 'confirm', 'client')).rejects.toThrow(/while the job is requested/);
    await run('accept', 'start');
    await expect(transition(P.cli, P.j.id, 'cancel', 'client')).rejects.toBeInstanceOf(Refused); // in progress: dispute, not cancel (P0-6)
    expect(await ledger()).toEqual([['hold', 8500]]);
  });

  it('the provider cannot release: no action for it, and transition() rejects the actor', async () => {
    await run('accept', 'start', 'complete');
    expect(Object.keys(providerActions).sort()).toEqual([
      'acceptJob', 'addStatementAsProvider', 'cancelJobAsProvider', 'completeJob', 'declineJob', 'disputeJobAsProvider', 'reviewClient', 'startJob',
    ]);
    await expect(transition(P.pro, P.j.id, 'confirm', 'provider')).rejects.toThrow(/cannot confirm/);
    expect((await job()).status).toBe('completed');
  });

  it('a move made on a stale read (a double-click, the cron racing a confirm) is refused and releases nothing twice', async () => {
    await run('accept', 'start', 'complete', 'confirm');
    // Replays the moment both requests read `completed`: the read is stale, the write is real.
    const stale = { findFirst: async () => ({ status: 'completed', amountCents: 8500 }), update: (a: never) => P.cli.update(a) } as unknown as typeof P.cli;
    await expect(transition(stale, P.j.id, 'confirm', 'client')).rejects.toThrow(/just changed/);
    expect(await ledger()).toEqual([['hold', 8500], ['release', 7650], ['fee', 850]]);
  });

  it("another provider's or another client's job is notFound", async () => {
    const q = await makeOrg('q');
    const w = await addMember(q.id, 'member', 'w@example.test');
    const qdb = providerDb(await actAs(w.id, 'q')).job;
    await expect(transition(qdb, P.j.id, 'accept', 'provider').catch(outcome)).resolves.toBe('notFound');
    await expect(transition(clientDb({ userId: w.id }).job, P.j.id, 'withdraw', 'client').catch(outcome)).resolves.toBe('notFound');
    expect((await job()).status).toBe('requested');
  });

  it('the ledger is append-only', async () => {
    await run('accept');
    await expect(db.ledgerEntry.updateMany({ data: { amountCents: 1 } })).rejects.toThrow(/append-only/);
    await expect(db.ledgerEntry.deleteMany({})).rejects.toThrow(/append-only/);
    await expect(db.job.delete({ where: { id: P.j.id } })).rejects.toThrow();
  });
});

describe('auto-confirm (cron, injected clock)', () => {
  it('releases 72h after completion, not before, and skips a job the client already confirmed', async () => {
    await run('accept', 'start', 'complete');
    const j2 = await db.job.create({ data: { ...JOB, orgId: P.p.id, listingId: P.l.id, clientId: P.c.id } });
    for (const n of ['accept', 'start', 'complete', 'confirm'] as const) await transition(n === 'confirm' ? P.cli : P.pro, j2.id, n, n === 'confirm' ? 'client' : 'provider');

    advanceClock(AUTO_CONFIRM_MS - 60_000);
    expect(await autoConfirmDue()).toEqual({ confirmed: 0 });
    advanceClock(AUTO_CONFIRM_MS);
    expect(await autoConfirmDue()).toEqual({ confirmed: 1 });
    expect(await autoConfirmDue()).toEqual({ confirmed: 0 });
    expect(await ledger()).toEqual([['hold', 8500], ['release', 7650], ['fee', 850]]);
    expect(await db.auditEvent.count({ where: { action: 'job.autoConfirm', targetId: P.j.id, actorUserId: null } })).toBe(1);
  });
});

describe('requestJob', () => {
  const at = (date: string) => ({ listingId: P.l.id, date });

  it('books at the listing rate on a day the pro works', async () => {
    await signInAs(P.c.id);
    expect(await requestJob(at('2026-10-06')).catch(outcome)).toBe('redirect');
    const mine = await clientDb({ userId: P.c.id }).job.findMany({ where: { id: { not: P.j.id } } });
    expect(mine.map((j) => [j.status, j.amountCents, j.orgId])).toEqual([['requested', 8500, P.p.id]]);
  });

  it("refuses a past date, a day off, and the provider's own member", async () => {
    await signInAs(P.c.id);
    const today = now().toISOString().slice(0, 10);
    expect(await requestJob(at('2020-01-06'))).toEqual({ error: 'Pick today or a later date.' });
    expect(await requestJob(at('2026-10-04'))).toEqual({ error: 'This pro does not work that day.' }); // a Sunday
    await signInAs(P.u.id, { mfa: true });
    expect(await requestJob(at(today))).toEqual({ error: 'You cannot book your own business.' });
    expect(await db.job.count()).toBe(1);
  });
});

describe('disputes (P0-6)', () => {
  const dispute = (by: 'client' | 'provider' = 'client') => transition(by === 'client' ? P.cli : P.pro, P.j.id, 'dispute', by, { statement: `${by} says` });
  const admin = async () => {
    const a = await db.user.create({ data: { email: 'admin@example.test', totpEnrolledAt: now() } });
    await db.platformAdmin.create({ data: { userId: a.id } });
    return a;
  };

  it('opens from in progress or completed, freezes the escrow, and halts auto-confirm', async () => {
    await run('accept');
    await expect(dispute()).rejects.toThrow(/while the job is accepted/);
    await run('start', 'complete');
    await dispute('provider');
    advanceClock(AUTO_CONFIRM_MS * 2);
    expect(await autoConfirmDue()).toEqual({ confirmed: 0 });
    expect((await job()).status).toBe('disputed');
    expect(await ledger()).toEqual([['hold', 8500]]);
  });

  it('frozen funds move only by the admin resolution: no other transition leaves `disputed`', async () => {
    const out = Object.entries(TRANSITIONS).filter(([, t]) => ([t.from].flat() as string[]).includes('disputed'));
    expect(out.map(([n, t]) => [n, t.by])).toEqual([['resolve', ['admin']]]);
    await run('accept', 'start');
    await dispute();
    await expect(transition(P.pro, P.j.id, 'resolve', 'provider')).rejects.toThrow(/cannot resolve/);
    await expect(transition(P.cli, P.j.id, 'confirm', 'client')).rejects.toBeInstanceOf(Refused);
    expect(await ledger()).toEqual([['hold', 8500]]);
  });

  it.each([
    [2500, [['hold', 8500], ['release', 5400], ['fee', 600], ['refund', 2500]]], // split: the fee is on the released part only
    [8500, [['hold', 8500], ['refund', 8500]]],
    [0, [['hold', 8500], ['release', 7650], ['fee', 850]]],
  ])('a resolution refunding %i writes the split, closes the job and audits, together', async (refund, rows) => {
    const a = await admin();
    await run('accept', 'start', 'complete');
    await dispute();
    await settleDispute(P.j.id, a.id, refund);
    expect(await ledger()).toEqual(rows);
    expect(await job()).toMatchObject({ status: 'closed', closedAt: expect.any(Date) });
    expect(await db.dispute.findUnique({ where: { jobId: P.j.id } })).toMatchObject({ resolvedBy: a.id, refundCents: refund });
    expect(await db.auditEvent.findMany({ where: { action: 'dispute.resolve' }, select: { actorUserId: true, orgId: true, data: true } }))
      .toEqual([{ actorUserId: a.id, orgId: P.p.id, data: { refundCents: refund } }]);
  });

  it('a refund over the hold is refused, and neither the ledger nor the audit log moves', async () => {
    const a = await admin();
    await run('accept', 'start');
    await dispute();
    await expect(settleDispute(P.j.id, a.id, 8501)).rejects.toThrow(/between \$0 and the amount held/);
    await expect(settleDispute(P.j.id, a.id, 8500)).resolves.toBeUndefined();
    await expect(settleDispute(P.j.id, a.id, 0)).rejects.toThrow(/while the job is closed/); // settled once
    expect(await ledger()).toEqual([['hold', 8500], ['refund', 8500]]);
    expect(await db.auditEvent.count({ where: { action: 'dispute.resolve' } })).toBe(1);
  });

  it('statements reach the admin view only: a party cannot read the dispute through its own job', async () => {
    await run('accept', 'start');
    await dispute();
    await submitStatement(P.pro, P.j.id, 'provider', 'provider says');
    expect((await openDisputes())[0]!.dispute).toMatchObject({ openedBy: 'client', clientStatement: 'client says', providerStatement: 'provider says' });
    for (const side of [P.cli, P.pro]) expect(await side.findFirst({ where: { id: P.j.id } })).not.toHaveProperty('dispute');
    await expect(submitStatement(P.cli, (await db.job.create({ data: { ...JOB, orgId: P.p.id, listingId: P.l.id, clientId: P.c.id } })).id, 'client', 'x'))
      .rejects.toThrow(/no open dispute/);
  });

  it('the resolve action: notFound for a non-admin, MFA required, then settles', async () => {
    const a = await admin();
    await run('accept', 'start');
    await dispute();
    const input = { jobId: P.j.id, refund: '25.50' };
    await signInAs(P.c.id);
    expect(await resolveDispute(input).catch(outcome)).toBe('notFound');
    await signInAs(a.id); // enrolled, MFA not passed
    expect(await resolveDispute(input).catch((e) => (e instanceof NavSignal ? e.to : e))).toBe('/login/mfa');
    await signInAs(a.id, { mfa: true });
    expect(await resolveDispute(input).catch(outcome)).toBe('redirect');
    expect(await ledger()).toEqual([['hold', 8500], ['release', 5355], ['fee', 595], ['refund', 2550]]);
  });
});

describe('blind reviews (P0-5)', () => {
  const close = () => run('accept', 'start', 'complete', 'confirm');
  const seen = async (side: 'client' | 'provider') =>
    (await (side === 'client' ? P.cli : P.pro).findFirstOrThrow({ where: { id: P.j.id }, include: reviewsVisibleTo(side) })).reviews.map((r) => [r.by, r.stars]);
  const rating = () => db.providerRating.findUnique({ where: { orgId: P.p.id }, select: { count: true, sum: true } });

  it('only on a closed job, once per party, inside the 14-day window', async () => {
    await expect(submitReview(P.cli, P.j.id, 'client', 5, '')).rejects.toThrow(/once it is closed/);
    await close();
    await submitReview(P.cli, P.j.id, 'client', 5, '');
    await expect(submitReview(P.cli, P.j.id, 'client', 1, '')).rejects.toThrow(/already reviewed/);
    advanceClock(REVIEW_WINDOW_MS);
    await expect(submitReview(P.pro, P.j.id, 'provider', 4, '')).rejects.toThrow(/window has ended/);
  });

  it("neither party reads the other's review before publication, through the actions and the pages' query", async () => {
    await close();
    await signInAs(P.c.id);
    expect(await reviewPro({ id: P.j.id, stars: '2', body: 'Late' }).catch(outcome)).toBe('redirect');
    expect(await seen('provider')).toEqual([]); // the pro cannot see it
    expect(await seen('client')).toEqual([['client', 2]]);
    expect(await rating()).toBeNull(); // unpublished stars do not count yet

    await actAs(P.u.id, 'p');
    expect(await providerActions.reviewClient('p', { id: P.j.id, stars: '5', body: '' }).catch(outcome)).toBe('redirect');
    expect(await seen('provider')).toEqual([['client', 2], ['provider', 5]]);
    expect(await seen('client')).toEqual([['client', 2], ['provider', 5]]);
    expect(await rating()).toEqual({ count: 1, sum: 2 }); // only the client's review rates the pro
  });

  it('a lone review publishes when the window ends, exactly once', async () => {
    await close();
    await submitReview(P.cli, P.j.id, 'client', 4, '');
    advanceClock(REVIEW_WINDOW_MS - 60_000);
    expect(await publishDueReviews()).toEqual({ published: 0 });
    expect(await seen('provider')).toEqual([]);
    advanceClock(REVIEW_WINDOW_MS);
    expect(await publishDueReviews()).toEqual({ published: 1 });
    expect(await publishDueReviews()).toEqual({ published: 0 });
    await publishReviews(P.j.id, false); // a late racer finds nothing left to publish
    expect(await seen('provider')).toEqual([['client', 4]]);
    expect(await rating()).toEqual({ count: 1, sum: 4 });
  });

  it('the aggregate matches a hand tally', async () => {
    const stars = [5, 4, 2, 5];
    for (const n of stars) {
      const j = await db.job.create({ data: { ...JOB, orgId: P.p.id, listingId: P.l.id, clientId: P.c.id } });
      for (const t of ['accept', 'start', 'complete', 'confirm'] as const) await transition(t === 'confirm' ? P.cli : P.pro, j.id, t, t === 'confirm' ? 'client' : 'provider');
      await submitReview(P.cli, j.id, 'client', n, '');
      await submitReview(P.pro, j.id, 'provider', 1, ''); // the pro's review of the client never counts
    }
    expect(await rating()).toEqual({ count: 4, sum: 16 }); // mean 4.0
  });
});
