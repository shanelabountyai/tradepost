'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { orgAction } from '@/core/authz/action';
import type { OrgCtx } from '@/core/authz/guards';
import { db } from '@/core/db';
import { env } from '@/core/env';
import { Refused } from '@/core/errors';
import { paymentProvider } from '@/modules/billing/provider';

const returnUrl = (ctx: OrgCtx) => `${env.APP_URL}/o/${ctx.slug}/settings/billing`;
const customerOf = async (ctx: OrgCtx) => (await db.billingAccount.findUnique({ where: { orgId: ctx.orgId } }))?.stripeCustomerId ?? null;

// `attempt` is minted once per rendered form, so a double submit or a retried request reuses the
// Idempotency-Key and Stripe returns the same checkout; a fresh visit gets a fresh one.
export const startCheckout = orgAction('billing.manage', z.object({ attempt: z.string().regex(/^[\w-]{16,64}$/) }), async (ctx, i) => {
  const url = await paymentProvider().checkout({
    orgId: ctx.orgId,
    customerId: await customerOf(ctx),
    email: ctx.session.email,
    returnUrl: returnUrl(ctx),
    idempotencyKey: `checkout:${ctx.orgId}:${i.attempt}`,
  });
  redirect(url);
});

export const openPortal = orgAction('billing.manage', z.object({}), async (ctx) => {
  const customerId = await customerOf(ctx);
  if (!customerId) throw new Refused('There is no billing account to manage yet.');
  redirect(await paymentProvider().portal({ customerId, returnUrl: returnUrl(ctx) }));
});
