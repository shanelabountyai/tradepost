// Request helpers for the route handlers that take anonymous POSTs (D-12: logic lives here).

/** Vercel sets x-forwarded-for to the client address; locally it is absent. */
export const clientIp = (h: Headers) => h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

/**
 * Login CSRF guard for plain-form POSTs (server actions get this check from Next). Without it,
 * another site could post its own link token and sign a visitor into the attacker's account.
 */
export function isSameOrigin(h: Headers): boolean {
  const origin = h.get('origin');
  if (origin) return URL.canParse(origin) && new URL(origin).host === h.get('host');
  return h.get('sec-fetch-site') === 'same-origin';
}
