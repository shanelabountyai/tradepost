import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// Every bearer token (login link, session, invite, share link, recovery code) is stored
// only as its sha256 (INV-07). Plain sha256 is right: these are 256-bit random values,
// not user-chosen secrets, so there is no dictionary to slow down.
export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Constant-time string compare for secrets (INV-10). */
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
