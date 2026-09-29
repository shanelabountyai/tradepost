'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { audit } from '@/core/audit';
import { db } from '@/core/db';
import { manageAction } from '@/lib/roles';

// D-021: a provider's SMS contact number. One row per org, keyed by ctx.orgId (never a foreign id,
// so this needs no tenancy.ts scoping — same shape as billing/actions.ts's BillingAccount reads).
const page = (slug: string) => `/o/${slug}/settings/contact`;

export const setContactPhone = manageAction(
  z.object({ phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, 'Enter a phone number in +1XXXXXXXXXX format.') }),
  async (ctx, { phone }) => {
    await db.orgContact.upsert({ where: { orgId: ctx.orgId }, create: { orgId: ctx.orgId, phone }, update: { phone } });
    await audit(ctx, 'org.contact_updated'); // never the number itself (INV-13)
    redirect(page(ctx.slug));
  },
);

export const clearContactPhone = manageAction(z.object({}), async (ctx) => {
  await db.orgContact.deleteMany({ where: { orgId: ctx.orgId } });
  await audit(ctx, 'org.contact_cleared');
  redirect(page(ctx.slug));
});
