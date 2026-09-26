import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as providerActions from '@/app/o/[org]/jobs/actions';
import { requestJob } from '@/app/jobs/actions';
import { advanceClock, now } from '@/core/clock';
import { db } from '@/core/db';
import { Refused } from '@/core/errors';
import { AUTO_CONFIRM_MS, autoConfirmDue, escrow, ledgerRows, transition, TRANSITIONS } from '@/lib/jobs';
import { clientDb, providerDb } from '@/lib/tenancy';
import { JOB, LISTING } from '../fixtures/app';
import { resetAuthTables, signInAs } from '../helpers/auth';
import { NavSignal } from '../helpers/next';
import { actAs, addMember, makeOrg } from '../helpers/org';

// P0-3/P0-4. Provider P (member u), client C, and one job J at $85 in `requested`.
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
      closed: [j.amountCents, j.amountCents], cancelled: e.held ? [j.amountCents, j.amountCents] : [0, 0],
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
    expect(Object.keys(providerActions).sort()).toEqual(['acceptJob', 'cancelJobAsProvider', 'completeJob', 'declineJob', 'startJob']);
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
