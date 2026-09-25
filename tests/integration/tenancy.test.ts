import { beforeEach, describe, expect, it } from 'vitest';
import { notFoundOnP2025 } from '@/core/authz/guards';
import { db } from '@/core/db';
import { clientDb, providerDb } from '@/lib/tenancy';
import { resetAuthTables } from '../helpers/auth';
import { NavSignal } from '../helpers/next';
import { actAs, addMember, makeOrg } from '../helpers/org';

// P0-1. Provider P and provider Q. U is dual-role: a member of P, and the client of a job at Q.
// C is a plain client with a job at P.
let P: Awaited<ReturnType<typeof setup>>;
async function setup() {
  const [p, q] = [await makeOrg('p'), await makeOrg('q')];
  const u = await addMember(p.id, 'member', 'u@example.test');
  const c = await db.user.create({ data: { email: 'c@example.test' } });
  const lP = await db.listing.create({ data: { orgId: p.id, title: 'P plumbing' } });
  const lQ = await db.listing.create({ data: { orgId: q.id, title: 'Q painting' } });
  const jP = await db.job.create({ data: { orgId: p.id, listingId: lP.id, clientId: c.id } });
  const jQ = await db.job.create({ data: { orgId: q.id, listingId: lQ.id, clientId: u.id } });
  return { p, q, u, c, lP, lQ, jP, jQ, ctxU: await actAs(u.id, 'p') };
}

beforeEach(async () => {
  await resetAuthTables();
  P = await setup();
});

const outcome = (e: unknown) => (e instanceof NavSignal ? e.kind : e);

describe('provider scope', () => {
  it("another provider's job by id is not found, and stays unchanged", async () => {
    const pdb = providerDb(P.ctxU);
    expect(await pdb.job.findUnique({ where: { id: P.jQ.id } })).toBeNull();
    expect(await pdb.listing.findFirst({ where: { id: P.lQ.id } })).toBeNull();
    const update = await pdb.listing.update({ where: { id: P.lQ.id }, data: { title: 'pwned' } }).catch(notFoundOnP2025).catch(outcome);
    expect(update).toBe('notFound');
    expect((await pdb.job.deleteMany({})).count).toBe(1);
    expect(await db.job.findUnique({ where: { id: P.jQ.id } })).not.toBeNull();
    expect((await db.listing.findUniqueOrThrow({ where: { id: P.lQ.id } })).title).toBe('Q painting');
  });

  it("a create is stamped with the caller's org, whatever it names", async () => {
    const l = await providerDb(P.ctxU).listing.create({ data: { orgId: P.q.id, title: 'x' } });
    expect(l.orgId).toBe(P.p.id);
  });

  it('refuses to move a row between tenants', async () => {
    const pdb = providerDb(P.ctxU);
    await expect(pdb.listing.update({ where: { id: P.lP.id }, data: { orgId: P.q.id } })).rejects.toThrow(/immutable/);
    await expect(pdb.job.updateMany({ data: { clientId: P.u.id } })).rejects.toThrow(/immutable/);
  });
});

describe('client scope', () => {
  it("a client cannot read another client's job", async () => {
    expect(await clientDb({ userId: P.c.id }).job.findUnique({ where: { id: P.jQ.id } })).toBeNull();
  });

  it("the database refuses a job whose listing is another provider's", async () => {
    await expect(clientDb({ userId: P.c.id }).job.create({ data: { orgId: P.p.id, listingId: P.lQ.id, clientId: P.c.id } })).rejects.toThrow();
  });
});

describe('dual-role user', () => {
  it('provider view and client view never bleed into each other', async () => {
    const asProvider = await providerDb(P.ctxU).job.findMany();
    const asClient = await clientDb(P.ctxU.session).job.findMany();
    expect(asProvider.map((j) => j.id)).toEqual([P.jP.id]);
    expect(asClient.map((j) => j.id)).toEqual([P.jQ.id]);
  });
});
