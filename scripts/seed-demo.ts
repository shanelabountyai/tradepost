import { pathToFileURL } from 'node:url';
import { advanceClock, now } from '@/core/clock';
import { sealSecret } from '@/core/auth/secret-box';
import { db } from '@/core/db'; // importing it is what refuses a cloud database (INV-18, INV-27)
import type { Role, ServiceCategory } from '@/generated/prisma/enums';
import { AUTO_CONFIRM_MS, autoConfirmDue, settleDispute, submitStatement, transition, TRANSITIONS, type Transition } from '@/lib/jobs';
import { submitReview } from '@/lib/reviews';
import { clientDb, providerDb } from '@/lib/tenancy';
import { postMessage } from '@/lib/threads';

// Demo data (spec §7, D-8). Only this script sets `isDemo`, and the cloud guard in `@/core/db` refuses a
// non-local database unless ALLOW_CLOUD_DB=1. The TOTP secret is a fixed, public demo value: known
// credentials are fine because this seed cannot reach production.
// Tradepost's demo: two providers, a client, a platform admin, and the capstone (PRD phasing): one job
// run twice through the real transitions, the happy path and then dispute → split, each with a thread.
// Six demo users, four TOTP-enrolled: tests/invariants/inv-27-demo.test.ts counts them.
export const DEMO_TOTP_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

const AUSTIN = { lat: 30.2672, lng: -97.7431 };
const PROVIDERS = [
  {
    slug: 'brightline', name: 'Brightline Plumbing', domain: 'brightline.demo.test', roles: ['owner', 'admin', 'member'] as Role[],
    listing: { title: 'Leak repair & fixture installs', category: 'plumbing' as const, rateCents: 18_500, radiusMiles: 15, days: [1, 2, 3, 4, 5, 6] },
  },
  {
    slug: 'fernway', name: 'Fernway Cleaning', domain: 'fernway.demo.test', roles: ['owner'] as Role[],
    listing: { title: 'Deep clean, 3-bed home', category: 'cleaning' as const, rateCents: 22_000, radiusMiles: 20, days: [0, 1, 2, 3, 4, 5, 6] },
  },
];
const CLIENT = 'client@tradepost.demo.test';
const PLATFORM_ADMIN = 'ops@tradepost.demo.test';

const totp = () => ({ totpSecretSealed: sealSecret(DEMO_TOTP_SECRET, 'totp'), totpEnrolledAt: now(), totpLastStep: null });
const demoUser = async (email: string, name: string, mfa: boolean) => {
  const data = { isDemo: true, name, ...(mfa && totp()) };
  return db.user.upsert({ where: { email }, create: { email, ...data }, update: data });
};

export async function seedDemo() {
  const printed: string[] = [];
  const orgIds: Record<string, string> = {};
  for (const p of PROVIDERS) {
    const org = await db.org.upsert({ where: { slug: p.slug }, create: { slug: p.slug, name: p.name }, update: {} });
    orgIds[p.slug] = org.id;
    for (const role of p.roles) {
      const email = `${role}@${p.domain}`;
      const mfa = role !== 'member'; // owners and admins are TOTP-enrolled, as the guard requires
      const user = await demoUser(email, `${role[0]!.toUpperCase()}${role.slice(1)} (${p.name})`, mfa);
      await db.membership.upsert({
        where: { orgId_userId: { orgId: org.id, userId: user.id } },
        create: { orgId: org.id, userId: user.id, role },
        update: { role },
      });
      printed.push(`${email}  ${role} of ${p.name}${mfa ? '  (TOTP)' : ''}`);
    }
    const listings = providerDb({ orgId: org.id }).listing;
    if (!(await listings.findFirst({ where: { title: p.listing.title } }))) await listings.create({ data: { ...p.listing, ...AUSTIN, orgId: org.id } });
  }

  const client = await demoUser(CLIENT, 'Dana Whitfield (client)', false);
  printed.push(`${CLIENT}  client`);
  const admin = await demoUser(PLATFORM_ADMIN, 'Platform ops', true);
  await db.platformAdmin.upsert({ where: { userId: admin.id }, create: { userId: admin.id }, update: {} });
  printed.push(`${PLATFORM_ADMIN}  platform admin, resolves disputes at /admin/disputes  (TOTP)`);

  // The capstone, once: a re-run finds the client's jobs and leaves them alone.
  const cli = clientDb({ userId: client.id }).job;
  if (!(await cli.count())) {
    const orgId = orgIds.brightline!;
    const pro = providerDb({ orgId }).job;
    const listing = (await providerDb({ orgId }).listing.findFirstOrThrow({ select: { id: true, rateCents: true } }));
    const book = () => cli.create({ data: { orgId, listingId: listing.id, clientId: client.id, date: new Date(now().toISOString().slice(0, 10)), amountCents: listing.rateCents } });
    const run = async (id: string, ...names: Transition[]) => {
      for (const n of names) await transition(TRANSITIONS[n].by[0] === 'provider' ? pro : cli, id, n, TRANSITIONS[n].by[0]);
    };

    const happy = await book();
    await postMessage(cli, happy.id, 'client', 'Kitchen sink is dripping under the cabinet. Gate code is 4417.');
    await postMessage(pro, happy.id, 'provider', 'Got it. I will bring a new P-trap in case the old one is corroded.');
    await run(happy.id, 'accept', 'start', 'complete', 'confirm');
    await submitReview(cli, happy.id, 'client', 5, 'On time, tidy, and fixed it in under an hour.');
    await submitReview(pro, happy.id, 'provider', 5, 'Clear directions and easy access.');

    const disputed = await book();
    await postMessage(cli, disputed.id, 'client', 'The bathroom faucet needs replacing. I bought the fixture already.');
    await run(disputed.id, 'accept', 'start', 'complete');
    await postMessage(cli, disputed.id, 'client', 'The faucet is leaking again at the base, a day later.');
    await postMessage(pro, disputed.id, 'provider', 'The fixture you supplied has a cracked cartridge. The install itself is sound.');
    await transition(cli, disputed.id, 'dispute', 'client', { statement: 'Paid for an install that leaks. I want a refund.' });
    await submitStatement(pro, disputed.id, 'provider', 'Install was correct; the client-supplied part is defective. Photos in the thread.');
    await settleDispute(disputed.id, admin.id, 7_400); // 40% back to the client; the rest released less the 10% fee
    printed.push(`capstone: two Brightline jobs for ${CLIENT}, one confirmed, one disputed and split`);
  }
  return printed;
}

/**
 * PRD success metric: a seeded month of 30 providers, 120 clients (10 of them also run a provider) and 200 jobs,
 * 15 of them disputed. Every job is driven through transition() on the injected clock, so the cron's 72h
 * auto-confirm fires as it would, and the month ends with every job terminal. Deterministic: job i's provider,
 * client and path follow from i. Not demo users; tests/integration/seeded-month.test.ts checks the outcome.
 */
export const MONTH = { providers: 30, clients: 120, jobs: 200, dualRole: 10 };
const CATEGORIES: ServiceCategory[] = ['plumbing', 'electrical', 'cleaning', 'painting', 'handyman', 'landscaping'];
const DAY = 86_400_000;

export async function seedMonth() {
  if (await db.org.findUnique({ where: { slug: 'month-p00' } })) return; // already seeded
  const clients = [];
  for (let c = 0; c < MONTH.clients; c++) clients.push(await db.user.create({ data: { email: `client-${String(c).padStart(3, '0')}@month.demo.test` } }));
  const providers = [];
  for (let p = 0; p < MONTH.providers; p++) {
    const org = await db.org.create({ data: { slug: `month-p${String(p).padStart(2, '0')}`, name: `Month pro ${p}` } });
    // Dual-role: provider p is owned by client p+1, who never books p (job i pairs provider i%30 with client i%120).
    if (p < MONTH.dualRole) await db.membership.create({ data: { orgId: org.id, userId: clients[p + 1]!.id, role: 'owner' } });
    const listing = await providerDb({ orgId: org.id }).listing.create({
      data: { orgId: org.id, title: `Month listing ${p}`, category: CATEGORIES[p % CATEGORIES.length]!, ...AUSTIN, radiusMiles: 25, rateCents: 6_001 + p * 137, days: [0, 1, 2, 3, 4, 5, 6] },
    });
    providers.push({ orgId: org.id, listing, jobs: providerDb({ orgId: org.id }).job });
  }
  const admin = await db.user.create({ data: { email: 'ops@month.demo.test' } });
  const disputes: { id: string; amountCents: number; k: number }[] = [];
  try {
    for (let i = 0; i < MONTH.jobs; i++) {
      advanceClock(Math.floor((i * 30) / MONTH.jobs) * DAY); // 200 jobs over 30 days
      await autoConfirmDue(); // the daily cron
      const p = providers[i % MONTH.providers]!;
      const client = clients[i % MONTH.clients]!;
      const cli = clientDb({ userId: client.id }).job;
      const job = await cli.create({ data: { orgId: p.orgId, listingId: p.listing.id, clientId: client.id, date: new Date(now().toISOString().slice(0, 10)), amountCents: p.listing.rateCents } });
      const run = async (...names: Transition[]) => {
        for (const n of names) await transition(TRANSITIONS[n].by[0] === 'provider' ? p.jobs : cli, job.id, n, TRANSITIONS[n].by[0]);
      };
      await postMessage(cli, job.id, 'client', `Job ${i}: when can you come?`);
      if (i % 13 === 5) {
        // 15 disputes, opened by either side, split three ways: no refund, a partial one, a full one
        await run('accept', 'start', 'complete');
        const by = i % 2 ? 'client' : 'provider';
        await transition(by === 'client' ? cli : p.jobs, job.id, 'dispute', by, { statement: `Job ${i} went wrong.` });
        disputes.push({ id: job.id, amountCents: job.amountCents, k: disputes.length });
        continue;
      }
      const path = i % 10;
      if (path === 0) await run('decline');
      else if (path === 1) await run('withdraw');
      else if (path === 2) await run('accept', 'cancel');
      else if (path <= 5) await run('accept', 'start', 'complete'); // left to the cron's auto-confirm
      else {
        await run('accept', 'start', 'complete', 'confirm');
        await submitReview(cli, job.id, 'client', 3 + (i % 3), '');
        await submitReview(p.jobs, job.id, 'provider', 5, '');
      }
    }
    for (const d of disputes) await settleDispute(d.id, admin.id, [0, Math.floor(d.amountCents / 3), d.amountCents][d.k % 3]!);
    advanceClock(31 * DAY + AUTO_CONFIRM_MS); // month end: the last completions pass 72h
    await autoConfirmDue();
  } finally {
    advanceClock(0); // back to the real clock
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const lines = await seedDemo();
  console.log(`Seeded demo accounts. Sign in at /demo (DEMO_MODE=1):\n  ${lines.join('\n  ')}`);
  console.log(`TOTP secret for the (TOTP) accounts, for an authenticator app: ${DEMO_TOTP_SECRET}`);
  if (process.argv.includes('--month')) {
    await seedMonth();
    console.log(`Seeded a month: ${MONTH.providers} providers, ${MONTH.clients} clients, ${MONTH.jobs} jobs.`);
  }
  await db.$disconnect();
}
