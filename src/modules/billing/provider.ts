import { env } from '@/core/env';

// The payment seam (CT/BX pattern): Stripe when a key is set, a mock otherwise. Hand-rolled over
// fetch, not the SDK (RB `stripe-adapter.ts`): two endpoints and one header. Take the SDK if the
// surface outgrows this file.

export type CheckoutInput = {
  orgId: string;
  customerId: string | null; // reuse the org's Stripe customer on a re-subscribe
  email: string;
  returnUrl: string;
  /** Derived from the user's intent (one rendered form), never random per call: a retried request must reuse it. */
  idempotencyKey: string;
};

export interface PaymentProvider {
  readonly name: 'stripe' | 'mock';
  checkout(i: CheckoutInput): Promise<string>;
  portal(i: { customerId: string; returnUrl: string }): Promise<string>;
}

export const mockProvider: PaymentProvider = {
  name: 'mock',
  // No payment and no state change: the plan moves only when a webhook says so.
  checkout: async (i) => `${i.returnUrl}?checkout=mock`,
  portal: async (i) => `${i.returnUrl}?portal=mock`,
};

export function stripeProvider(secretKey: string, priceId: string): PaymentProvider {
  async function post(path: string, params: Record<string, string | null>, idempotencyKey?: string) {
    const body = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => e[1] !== null));
    const res = await fetch(`https://api.stripe.com/v1${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        // Only on a create: Stripe replays the first response for 24h, so a timed-out retry
        // cannot open a second checkout (and a second subscription).
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body,
    });
    const json = (await res.json()) as { url?: string; error?: { message?: string } };
    if (!res.ok || !json.url) throw new Error(`Stripe ${path} ${res.status}: ${json.error?.message ?? 'no url'}`);
    return json.url;
  }
  return {
    name: 'stripe',
    checkout: (i) =>
      post(
        '/checkout/sessions',
        {
          mode: 'subscription',
          'line_items[0][price]': priceId,
          'line_items[0][quantity]': '1',
          success_url: `${i.returnUrl}?checkout=done`,
          cancel_url: i.returnUrl,
          client_reference_id: i.orgId,
          // The webhook finds the org from this, so it works whichever event arrives first.
          'subscription_data[metadata][orgId]': i.orgId,
          customer: i.customerId,
          customer_email: i.customerId ? null : i.email,
        },
        i.idempotencyKey,
      ),
    portal: (i) => post('/billing_portal/sessions', { customer: i.customerId, return_url: i.returnUrl }),
  };
}

export function paymentProvider(): PaymentProvider {
  if (env.STRIPE_SECRET_KEY) {
    if (!env.STRIPE_PRICE_ID) throw new Error('STRIPE_PRICE_ID is required with STRIPE_SECRET_KEY');
    return stripeProvider(env.STRIPE_SECRET_KEY, env.STRIPE_PRICE_ID);
  }
  // A mock in production would be a Subscribe button that silently does nothing.
  if (env.VERCEL_ENV === 'production') throw new Error('STRIPE_SECRET_KEY is required in production');
  return mockProvider;
}
