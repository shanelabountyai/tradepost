import { afterAll, afterEach } from 'vitest';
import { TOTP, Secret } from 'otpauth';
import { advanceClock, now } from '@/core/clock';
import { db } from '@/core/db';
import { createSession, SESSION_COOKIE } from '@/core/auth/session';
import { confirmTotp, enrolTotp } from '@/core/auth/totp';
import { jar } from './next';

afterEach(() => advanceClock(0));
afterAll(() => db.$disconnect());

/** Empties every table the auth tests touch. */
export async function resetAuthTables() {
  await db.$executeRawUnsafe(
    'TRUNCATE "User", "Session", "LoginToken", "RecoveryCode", "RateLimit", "CapturedMessage", "Org", "Membership" CASCADE',
  );
}

export const makeUser = (email = 'ada@example.test') => db.user.create({ data: { email } });

/** Signs the jar in as `userId` with a fresh session; returns the raw session token. */
export async function signInAs(userId: string, opts: { mfa?: boolean } = {}) {
  const token = await createSession(userId, opts);
  jar.set(SESSION_COOKIE, token);
  return token;
}

export const codeFor = (secret: string) =>
  new TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secret) }).generate({ timestamp: now().getTime() });

/** Enrols the signed-in user in TOTP; returns the secret and the recovery codes. */
export async function enrol() {
  const { secret } = await enrolTotp();
  const codes = await confirmTotp(codeFor(secret));
  if (!codes) throw new Error('enrolment failed');
  return { secret, codes };
}
