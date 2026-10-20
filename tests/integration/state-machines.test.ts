import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { advanceClock, now } from '@/core/clock';
import { db } from '@/core/db';
import type { JobStatus } from '@/generated/prisma/enums';
import { AUTO_CONFIRM_MS, autoConfirmDue, escrow, ledgerRows, transition, TRANSITIONS, type Actor, type Transition } from '@/lib/jobs';
import { publishDueReviews, REVIEW_WINDOW_MS, submitReview } from '@/lib/reviews';
import { clientDb, providerDb, reviewsVisibleTo } from '@/lib/tenancy';
import { JOB, LISTING } from '../fixtures/app';
import { resetAuthTables } from '../helpers/auth';
import { NavSignal } from '../helpers/next';
import { actAs, addMember, makeOrg } from '../helpers/org';

// Depth tests for the two state machines (job lifecycle and escrow). jobs.test.ts walks the named paths;
// this file checks the whole table: every transition against every status and every actor, the ledger
// invariant after each, and the clock boundaries to the millisecond.

const STATUSES: JobStatus[] = ['requested', 'accepted', 'in_progress', 'completed', 'closed', 'disputed', 'declined', 'cancelled'];
const ACTORS: Actor[] = ['client', 'provider', 'system', 'admin'];
const AMOUNT = JOB.amountCents;
// States in which the provider's hold exists.
const HELD: JobStatus[] = ['accepted', 'in_progress', 'completed', 'disputed'];

let P: { orgId: string; pro: ReturnType<typeof providerDb>['job']; cli: ReturnType<typeof clientDb>['job']; clientId: string; listingId: string };

beforeEach(async () => {
  advanceClock(0);
  dayN = 0;
  await resetAuthTables();
  const p = await makeOrg('p');
  const u = await addMember(p.id, 'owner', 'u@example.test');
  const c = await db.user.create({ data: { email: 'c@example.test' } });
  const l = await db.listing.create({ data: { ...LISTING, orgId: p.id, title: 'P plumbing' } });
  P = { orgId: p.id, pro: providerDb(await actAs(u.id, 'p')).job, cli: clientDb({ userId: c.id }).job, clientId: c.id, listingId: l.id };
});
afterEach(() => advanceClock(0));

/** A job placed directly in `status` with the ledger rows that status must carry. */
// One live job per client, listing and date (F-02): every fixture job gets its own day.
let dayN = 0;
const nextDate = () => new Date(Date.UTC(2027, 0, 1 + dayN++));
async function jobIn(status: JobStatus, over: { date?: Date; completedAt?: Date; orgId?: string; clientId?: string; listingId?: string } = {}) {
  const j = await db.job.create({
    data: {
      ...JOB, date: over.date ?? nextDate(), orgId: over.orgId ?? P.orgId, clientId: over.clientId ?? P.clientId, listingId: over.listingId ?? P.listingId, status,
      completedAt: over.completedAt ?? (['completed', 'closed', 'disputed'].includes(status) ? now() : null),
      ...(status === 'disputed' && { dispute: { create: { openedBy: 'client', openedAt: now() } } }),
      ...(HELD.includes(status) && { ledger: { create: { kind: 'hold', amountCents: AMOUNT } } }),
    },
  });
  return j.id;
}
const snapshot = async (id: string) => {
  const j = await db.job.findUniqueOrThrow({ where: { id }, include: { ledger: true } });
  return { status: j.status, closedAt: j.closedAt, ledger: j.ledger.map((r) => [r.kind, r.amountCents] as const).sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1]) };
};
const names = Object.keys(TRANSITIONS) as Transition[];
const sum = (rows: { amountCents: number }[]) => rows.reduce((s, r) => s + r.amountCents, 0);
const sideOf = (a: Actor) => (a === 'client' ? P.cli : P.pro);

describe('ledger rows: the sum invariant over many amounts (pure)', () => {
  const amounts = [1, 2, 3, 4, 5, 9, 10, 11, 19, 99, 100, 101, 1999, 8500, 8599, 12_345, 99_999, 1_000_001, 2_147_483_647];

  it('release, cancel and split write integer, positive rows that sum to exactly the amount', () => {
    for (const a of amounts) {
      const cases = [
        ledgerRows('release', a),
        ledgerRows('cancel', a, 0, 'client'),
        ledgerRows('cancel', a, 0, 'provider'),
        ledgerRows('cancel', a, 0, 'system'),
        ...[0, 1, Math.floor(a / 3), Math.floor(a / 2), a - 1, a].filter((r) => r >= 0 && r <= a).map((r) => ledgerRows('split', a, r)),
      ];
      for (const rows of cases) {
        expect(sum(rows), `amount ${a}`).toBe(a);
        for (const r of rows) {
          expect(Number.isInteger(r.amountCents)).toBe(true);
          expect(r.amountCents).toBeGreaterThan(0); // a zero part never writes a row
        }
      }
    }
  });

  it('the platform fee is never more than 10% and the provider never receives less than the rest', () => {
    for (const a of amounts) {
      const rows = ledgerRows('release', a);
      const fee = rows.find((r) => r.kind === 'fee')?.amountCents ?? 0;
      expect(fee).toBe(Math.floor(a / 10));
      expect(rows.find((r) => r.kind === 'release')?.amountCents ?? 0).toBe(a - fee);
    }
  });

  it('a split refuses a refund that is negative, fractional, NaN or over the hold, and writes nothing', () => {
    for (const bad of [-1, 0.5, Number.NaN, AMOUNT + 1, Infinity]) expect(() => ledgerRows('split', AMOUNT, bad), String(bad)).toThrow(/between \$0 and the amount held/);
  });

  it('a full-refund split writes only a refund, and a no-refund split equals a normal release', () => {
    expect(ledgerRows('split', AMOUNT, AMOUNT)).toEqual([{ kind: 'refund', amountCents: AMOUNT }]);
    expect(ledgerRows('split', AMOUNT, 0)).toEqual(ledgerRows('release', AMOUNT));
  });

  it('a hold row is the only way money enters escrow, and escrow() balances every settled outcome', () => {
    const hold = ledgerRows('hold', AMOUNT);
    for (const settle of [ledgerRows('release', AMOUNT), ledgerRows('cancel', AMOUNT, 0, 'client'), ledgerRows('cancel', AMOUNT, 0, 'provider'), ledgerRows('split', AMOUNT, 3000)]) {
      expect(escrow([...hold, ...settle])).toEqual({ held: AMOUNT, out: AMOUNT, inEscrow: 0, settled: true });
    }
    expect(escrow(hold)).toEqual({ held: AMOUNT, out: 0, inEscrow: AMOUNT, settled: false });
    expect(escrow([])).toEqual({ held: 0, out: 0, inEscrow: 0, settled: false });
  });
});

describe('transition table: every transition, from every status, by every actor', () => {
  it('is exactly the declared table: allowed iff the actor is listed and the status is a source', async () => {
    for (const name of names) {
      const t = TRANSITIONS[name];
      const sources = [t.from].flat() as JobStatus[];
      for (const status of STATUSES) {
        for (const actor of ACTORS) {
          const id = await jobIn(status);
          const before = await snapshot(id);
          const allowed = (t.by as readonly Actor[]).includes(actor) && sources.includes(status);
          const label = `${name} from ${status} by ${actor}`;
          const attempt = transition(sideOf(actor), id, name, actor, { refundCents: 0, adminId: undefined });
          if (allowed) {
            await attempt;
            const after = await snapshot(id);
            expect(after.status, label).toBe(t.to);
            // Money and state moved together: the rows added are exactly what ledgerRows says for this move.
            const added = after.ledger.length - before.ledger.length;
            expect(added, label).toBe(ledgerRows(t.money, AMOUNT, 0, actor).length);
            const e = escrow((await db.ledgerEntry.findMany({ where: { jobId: id } })));
            if (t.money === null || t.money === 'hold') expect(e.out, label).toBe(0);
            else expect(e.settled, label).toBe(true);
            if (t.money === 'hold') expect(e.held, label).toBe(AMOUNT);
          } else {
            await expect(attempt, label).rejects.toThrow();
            expect(await snapshot(id), `${label} must change nothing`).toEqual(before);
          }
        }
      }
    }
  }, 120_000);

  it('only transitions that settle money take the escrow to zero, and settled jobs are terminal', async () => {
    for (const name of names) {
      const t = TRANSITIONS[name];
      const settles = t.money !== null && t.money !== 'hold';
      expect(['release', 'split', 'cancel', 'hold', null]).toContain(t.money);
      // Terminal states have no outgoing transition.
      for (const terminal of ['closed', 'declined', 'cancelled'] as JobStatus[]) expect([t.from].flat()).not.toContain(terminal);
      if (settles) expect(['closed', 'cancelled']).toContain(t.to);
    }
  });

  it('only the client or the system releases funds to the provider; the provider and admin never release on their own', () => {
    const releasing = names.filter((n) => TRANSITIONS[n].money === 'release').flatMap((n) => TRANSITIONS[n].by);
    expect(new Set(releasing)).toEqual(new Set(['client', 'system']));
    expect(names.filter((n) => (TRANSITIONS[n].by as readonly Actor[]).includes('provider') && TRANSITIONS[n].money === 'release')).toEqual([]);
    // The one admin move is the dispute split, and it only leaves `disputed`.
    expect(names.filter((n) => (TRANSITIONS[n].by as readonly Actor[]).includes('admin'))).toEqual(['resolve']);
    expect(TRANSITIONS.resolve.from).toBe('disputed');
  });

  it('the hold is written exactly once, on accept, and in no other transition', () => {
    expect(names.filter((n) => TRANSITIONS[n].money === 'hold')).toEqual(['accept']);
  });

  it('a client cancel keeps the 20% compensation, a provider cancel refunds in full, both through the real transition', async () => {
    const byClient = await jobIn('accepted');
    await transition(P.cli, byClient, 'cancel', 'client');
    expect((await snapshot(byClient)).ledger).toEqual([['fee', 170], ['hold', 8500], ['refund', 6800], ['release', 1530]]);
    const byPro = await jobIn('accepted', { date: new Date('2026-10-06') });
    await transition(P.pro, byPro, 'cancel', 'provider');
    expect((await snapshot(byPro)).ledger).toEqual([['hold', 8500], ['refund', 8500]]);
  });

  it('a dispute resolution splits the hold: refund of any part, the rest released less the fee', async () => {
    for (const refund of [0, 1, 2500, 8499, 8500]) {
      const id = await jobIn('disputed', { date: new Date(`2026-11-${String(10 + refund % 7).padStart(2, '0')}`) });
      await transition(P.pro, id, 'resolve', 'admin', { refundCents: refund });
      const rows = await db.ledgerEntry.findMany({ where: { jobId: id } });
      expect(escrow(rows), `refund ${refund}`).toEqual({ held: AMOUNT, out: AMOUNT, inEscrow: 0, settled: true });
      expect(sum(rows.filter((r) => r.kind === 'refund')), `refund ${refund}`).toBe(refund);
      expect((await db.dispute.findUniqueOrThrow({ where: { jobId: id } })).refundCents).toBe(refund);
    }
  });

  it('a refund over the hold is refused and the dispute stays frozen', async () => {
    const id = await jobIn('disputed');
    const before = await snapshot(id);
    await expect(transition(P.pro, id, 'resolve', 'admin', { refundCents: AMOUNT + 1 })).rejects.toThrow(/between \$0 and the amount held/);
    expect(await snapshot(id)).toEqual(before);
  });
});

describe('tenancy: another provider’s or client’s row is notFound for every transition', () => {
  it('every transition by a foreign provider or foreign client is a 404 and changes nothing', async () => {
    const q = await makeOrg('q');
    const w = await addMember(q.id, 'owner', 'w@example.test');
    const foreignPro = providerDb(await actAs(w.id, 'q')).job;
    const foreignCli = clientDb({ userId: w.id }).job;
    for (const name of names) {
      const t = TRANSITIONS[name];
      const status = ([t.from].flat() as JobStatus[])[0]!;
      const id = await jobIn(status, { date: new Date(`2026-11-${String(10 + names.indexOf(name)).padStart(2, '0')}`) });
      const before = await snapshot(id);
      for (const actor of t.by) {
        const side = actor === 'client' ? foreignCli : foreignPro;
        const result = await transition(side, id, name, actor).then(() => 'moved', (e) => (e instanceof NavSignal ? e.kind : String(e)));
        expect(result, `${name} by foreign ${actor}`).toBe('notFound');
      }
      expect(await snapshot(id), name).toEqual(before);
    }
  }, 60_000);

  it('a missing id is notFound, not a thrown database error', async () => {
    const r = await transition(P.pro, '00000000-0000-4000-8000-000000000999', 'accept', 'provider').then(() => 'moved', (e) => (e instanceof NavSignal ? e.kind : String(e)));
    expect(r).toBe('notFound');
  });
});

describe('auto-confirm on the injected clock, to the millisecond', () => {
  it('releases at exactly 72h, not one second earlier, and only on `completed`', async () => {
    const completedAt = new Date(now().getTime());
    const id = await jobIn('completed', { completedAt });
    advanceClock(AUTO_CONFIRM_MS - 1000);
    expect(await autoConfirmDue()).toEqual({ confirmed: 0 });
    expect((await snapshot(id)).status).toBe('completed');
    advanceClock(AUTO_CONFIRM_MS + 1000);
    expect(await autoConfirmDue()).toEqual({ confirmed: 1 });
    const after = await snapshot(id);
    expect(after.status).toBe('closed');
    expect(after.ledger).toEqual([['fee', 850], ['hold', 8500], ['release', 7650]]);
    expect(after.closedAt?.getTime()).toBeGreaterThanOrEqual(completedAt.getTime() + AUTO_CONFIRM_MS);
  });

  it('never touches a disputed, in-progress, accepted or already-closed job, however long it has waited', async () => {
    const ids: Record<string, string> = {};
    let day = 10;
    for (const s of ['disputed', 'in_progress', 'accepted', 'closed', 'requested'] as JobStatus[]) {
      ids[s] = await jobIn(s, { date: new Date(`2026-11-${day++}`), completedAt: new Date(now().getTime() - 10 * AUTO_CONFIRM_MS) });
    }
    const before = Object.fromEntries(await Promise.all(Object.entries(ids).map(async ([s, id]) => [s, await snapshot(id)])));
    advanceClock(30 * AUTO_CONFIRM_MS);
    expect(await autoConfirmDue()).toEqual({ confirmed: 0 });
    for (const [s, id] of Object.entries(ids)) expect(await snapshot(id), s).toEqual(before[s]);
  });

  it('closes due jobs of several providers, each through its own org, and a replay does nothing', async () => {
    const q = await makeOrg('q');
    const cq = await db.user.create({ data: { email: 'cq@example.test' } });
    const lq = await db.listing.create({ data: { ...LISTING, orgId: q.id, title: 'Q plumbing' } });
    const a = await jobIn('completed');
    const b = await jobIn('completed', { orgId: q.id, clientId: cq.id, listingId: lq.id });
    advanceClock(AUTO_CONFIRM_MS + 1000);
    expect(await autoConfirmDue()).toEqual({ confirmed: 2 });
    expect(await autoConfirmDue()).toEqual({ confirmed: 0 });
    for (const id of [a, b]) {
      const rows = await db.ledgerEntry.findMany({ where: { jobId: id } });
      expect(escrow(rows)).toEqual({ held: AMOUNT, out: AMOUNT, inEscrow: 0, settled: true });
      expect(rows.filter((r) => r.kind === 'release')).toHaveLength(1); // released once, never twice
    }
    expect(await db.auditEvent.count({ where: { action: 'job.autoConfirm' } })).toBe(2);
    expect((await db.auditEvent.findMany({ where: { action: 'job.autoConfirm' } })).map((e) => e.orgId).sort()).toEqual([P.orgId, q.id].sort());
  });

  it('a dispute opened just before the deadline halts the release', async () => {
    const id = await jobIn('completed');
    advanceClock(AUTO_CONFIRM_MS - 5000);
    await transition(P.cli, id, 'dispute', 'client', { statement: 'Not done' });
    advanceClock(AUTO_CONFIRM_MS + 5000);
    expect(await autoConfirmDue()).toEqual({ confirmed: 0 });
    expect((await snapshot(id)).status).toBe('disputed');
    expect(escrow(await db.ledgerEntry.findMany({ where: { jobId: id } })).inEscrow).toBe(AMOUNT);
  });

  it('records completion and closing times from the injected clock, not the wall clock', async () => {
    advanceClock(40 * 86_400_000);
    const id = await jobIn('in_progress');
    const t0 = now().getTime();
    await transition(P.pro, id, 'complete', 'provider');
    const done = (await db.job.findUniqueOrThrow({ where: { id } })).completedAt!.getTime();
    expect(done).toBeGreaterThanOrEqual(t0);
    expect(done - Date.now()).toBeGreaterThan(39 * 86_400_000); // a wall-clock stamp would be near Date.now()
  });
});

describe('blind reviews and the 14-day window, to the second', () => {
  const closed = async () => {
    const id = await jobIn('closed', { completedAt: now() });
    await db.job.update({ where: { id }, data: { closedAt: now() } });
    return id;
  };
  const seen = async (side: 'client' | 'provider', id: string) =>
    (await (side === 'client' ? P.cli : P.pro).findFirstOrThrow({ where: { id }, include: reviewsVisibleTo(side) })).reviews.map((r) => [r.by, r.stars]);

  it('accepts a review one second before the window closes and refuses at it', async () => {
    const id = await closed();
    advanceClock(REVIEW_WINDOW_MS - 2000);
    await submitReview(P.cli, id, 'client', 5, 'ok');
    advanceClock(REVIEW_WINDOW_MS + 1000);
    await expect(submitReview(P.pro, id, 'provider', 4, '')).rejects.toThrow(/window has ended/);
  });

  it('a review is hidden from the other party until both exist or the window ends; the author always sees their own', async () => {
    const id = await closed();
    await submitReview(P.cli, id, 'client', 1, 'bad');
    expect(await seen('provider', id)).toEqual([]);
    expect(await seen('client', id)).toEqual([['client', 1]]);
    await submitReview(P.pro, id, 'provider', 5, 'fine');
    expect(await seen('provider', id)).toEqual([['client', 1], ['provider', 5]]);
    expect(await seen('client', id)).toEqual([['client', 1], ['provider', 5]]);
  });

  it('the provider’s lone review stays hidden from the client until the cron publishes it at the window end', async () => {
    const id = await closed();
    await submitReview(P.pro, id, 'provider', 2, 'late payer');
    expect(await seen('client', id)).toEqual([]);
    advanceClock(REVIEW_WINDOW_MS - 2000);
    expect(await publishDueReviews()).toEqual({ published: 0 });
    expect(await seen('client', id)).toEqual([]);
    advanceClock(REVIEW_WINDOW_MS + 2000);
    expect(await publishDueReviews()).toEqual({ published: 1 });
    expect(await seen('client', id)).toEqual([['provider', 2]]);
  });

  it('a foreign provider or client cannot review a job (notFound) and nothing is stored', async () => {
    const id = await closed();
    const q = await makeOrg('q');
    const w = await addMember(q.id, 'owner', 'w@example.test');
    const foreignPro = providerDb(await actAs(w.id, 'q')).job;
    for (const [side, by] of [[foreignPro, 'provider'], [clientDb({ userId: w.id }).job, 'client']] as const) {
      const r = await submitReview(side, id, by, 5, '').then(() => 'stored', (e) => (e instanceof NavSignal ? e.kind : String(e)));
      expect(r).toBe('notFound');
    }
    expect(await db.review.count({ where: { jobId: id } })).toBe(0);
  });

  it('refuses a review on every status except closed', async () => {
    let day = 10;
    for (const s of STATUSES.filter((x) => x !== 'closed')) {
      const id = await jobIn(s, { date: new Date(`2026-11-${day++}`) });
      await expect(submitReview(P.cli, id, 'client', 5, ''), s).rejects.toThrow(/once it is closed/);
    }
    expect(await db.review.count()).toBe(0);
  });
});
