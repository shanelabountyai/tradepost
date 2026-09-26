import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { escrow } from '@/lib/jobs';
import { MONTH, seedDemo, seedMonth } from '../../scripts/seed-demo';
import { resetAuthTables } from '../helpers/auth';

beforeEach(resetAuthTables);

const TERMINAL = ['closed', 'declined', 'cancelled'];
const jobs = () => db.job.findMany({ include: { ledger: true, dispute: true }, orderBy: { createdAt: 'asc' } });
const rows = (ledger: { kind: string; amountCents: number }[]) => ledger.map((r) => [r.kind, r.amountCents]).sort();

describe('capstone demo seed', () => {
  it('runs one job twice: confirmed, then disputed and split, each balanced and with a thread', async () => {
    await seedDemo();
    await seedDemo(); // a re-run adds no jobs
    const [happy, split] = await jobs();
    expect(await db.job.count()).toBe(2);
    expect(happy).toMatchObject({ status: 'closed', dispute: null });
    expect(rows(happy!.ledger)).toEqual(rows([{ kind: 'hold', amountCents: 18_500 }, { kind: 'release', amountCents: 16_650 }, { kind: 'fee', amountCents: 1_850 }]));
    expect(split).toMatchObject({ status: 'closed', dispute: { refundCents: 7_400, resolvedAt: expect.any(Date) } });
    expect(rows(split!.ledger)).toEqual(rows([{ kind: 'hold', amountCents: 18_500 }, { kind: 'refund', amountCents: 7_400 }, { kind: 'release', amountCents: 9_990 }, { kind: 'fee', amountCents: 1_110 }]));
    for (const j of [happy!, split!]) expect(escrow(j.ledger).settled).toBe(true);
    expect(await db.message.count({ where: { jobId: happy!.id } })).toBe(2);
    expect(await db.message.count({ where: { jobId: split!.id } })).toBe(3);
    expect(await db.review.count({ where: { jobId: happy!.id, publishedAt: { not: null } } })).toBe(2);
    expect(await db.auditEvent.count({ where: { action: 'dispute.resolve' } })).toBe(1);
  });
});

describe('seeded month (PRD success metric)', () => {
  it('ends every one of 200 jobs terminal with a balanced ledger, including 15 disputes', { timeout: 180_000 }, async () => {
    await seedMonth();
    const all = await jobs();
    expect(all).toHaveLength(MONTH.jobs);
    for (const j of all) {
      expect(TERMINAL, `job ${j.id}`).toContain(j.status);
      const e = escrow(j.ledger);
      // declined or withdrawn: nothing ever held. Everything else: the hold is the amount, paid out exactly.
      expect([e.held, e.out], `job ${j.id} ${j.status}`).toEqual(e.held ? [j.amountCents, j.amountCents] : [0, 0]);
      if (j.status === 'closed') expect(e.settled).toBe(true);
    }
    const disputes = all.filter((j) => j.dispute);
    expect(disputes).toHaveLength(15);
    expect(disputes.every((j) => j.status === 'closed' && j.dispute!.resolvedAt)).toBe(true);
    expect(new Set(disputes.map((j) => j.dispute!.refundCents === 0 ? 'none' : j.dispute!.refundCents === j.amountCents ? 'full' : 'part'))).toEqual(new Set(['none', 'part', 'full']));
    // the platform's books: every cent held went back out
    const sum = (k: string[]) => all.flatMap((j) => j.ledger).filter((r) => k.includes(r.kind)).reduce((s, r) => s + r.amountCents, 0);
    expect(sum(['hold'])).toBeGreaterThan(0);
    expect(sum(['release', 'fee', 'refund'])).toBe(sum(['hold']));
    // every path ran, including the cron's auto-confirm
    expect(await db.auditEvent.count({ where: { action: 'job.autoConfirm' } })).toBeGreaterThan(0);
    expect(new Set(all.map((j) => j.status))).toEqual(new Set(TERMINAL));
    // dual-role: members who are also clients, and never a client of their own business
    const members = await db.membership.findMany({ select: { userId: true, orgId: true } });
    expect(members.filter((m) => all.some((j) => j.clientId === m.userId))).toHaveLength(MONTH.dualRole);
    expect(all.filter((j) => members.some((m) => m.userId === j.clientId && m.orgId === j.orgId))).toEqual([]);
  });
});
