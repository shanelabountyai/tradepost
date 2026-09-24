import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { env } from '@/core/env';

// Ported from rental `packages/core/auth/secret-box.ts`. AES-256-GCM for secrets we must
// read back (a TOTP seed), keyed by HKDF from AUTH_SECRET per purpose. A database dump alone
// opens nothing (INV-25). Rotating AUTH_SECRET makes every sealed value unreadable and forces
// TOTP re-enrolment: correct after a leak, and documented in the README.
const IV = 12;
const TAG = 16;

const key = (purpose: string) =>
  Buffer.from(hkdfSync('sha256', env.AUTH_SECRET, '', `saas-foundation/${purpose}/v1`, 32));

/** `iv.ciphertext.tag`, base64url. `purpose` must match on open. */
export function sealSecret(plaintext: string, purpose: string): string {
  const iv = randomBytes(IV);
  const c = createCipheriv('aes-256-gcm', key(purpose), iv, { authTagLength: TAG });
  const ct = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
  return [iv, ct, c.getAuthTag()].map((b) => b.toString('base64url')).join('.');
}

/** Null on any failure (wrong key, tampering, malformed): a caller treats it as absent. */
export function openSecret(sealed: string, purpose: string): string | null {
  const [iv, ct, tag] = sealed.split('.').map((p) => Buffer.from(p, 'base64url'));
  if (!iv || !ct || !tag || iv.length !== IV || tag.length !== TAG) return null;
  try {
    const d = createDecipheriv('aes-256-gcm', key(purpose), iv, { authTagLength: TAG });
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}
