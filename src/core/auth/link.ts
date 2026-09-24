import { z } from 'zod';
import { now } from '@/core/clock';
import { db } from '@/core/db';
import { env } from '@/core/env';
import { sendEmail } from '@/core/email/transport';
import { hit, LIMITS } from '@/core/rate-limit';
import { hashToken, newToken } from '@/core/tokens';
import { createSession } from './session';

const TTL_MS = 15 * 60_000;
const COOLDOWN_MS = 60_000;

export const normalizeEmail = (input: string) => {
  const e = input.trim().toLowerCase();
  return z.email().safeParse(e).success ? e : null;
};

/**
 * Sends a sign-in link to a known email and a sign-up link to an unknown one (D-10). It
 * resolves the same way whatever happens, so the form cannot probe who has an account.
 * Limited per IP and per email in Postgres (INV-09), plus a 60-second per-address cooldown.
 */
export async function requestLink(input: string, ip: string): Promise<void> {
  const email = normalizeEmail(input);
  if (!email) return;
  const [ipOk, emailOk] = [await hit(`link:ip:${ip}`, LIMITS.linkPerIp), await hit(`link:email:${email}`, LIMITS.linkPerEmail)];
  if (!ipOk || !emailOk) return;
  const t = now();
  if (await db.loginToken.count({ where: { email, createdAt: { gt: new Date(t.getTime() - COOLDOWN_MS) } } })) return;

  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  const token = newToken();
  await db.loginToken.create({
    data: { hash: hashToken(token), purpose: user ? 'login' : 'signup', email, userId: user?.id ?? null, createdAt: t, expiresAt: new Date(t.getTime() + TTL_MS) },
  });
  const url = `${env.APP_URL}/login/${token}`;
  await sendEmail(
    user
      ? { to: email, subject: 'Your sign-in link', body: `Sign in: ${url}\n\nThis link expires in 15 minutes. If you did not ask for it, ignore this email.` }
      : { to: email, subject: 'Create your account', body: `Create your account: ${url}\n\nThis link expires in 15 minutes. If you did not ask for it, ignore this email.` },
  );
}

/**
 * Spends a login or sign-up link, once and before expiry, and returns a raw session token or
 * null. POST only: GET must never reach this (INV-17). A sign-up link creates the user here,
 * not at request time (D-10); the upsert covers two sign-up links for one address.
 */
export async function redeemLink(token: string): Promise<string | null> {
  const hash = hashToken(token);
  const t = now();
  const spent = await db.loginToken.updateMany({
    where: { hash, purpose: { in: ['login', 'signup'] }, usedAt: null, expiresAt: { gt: t } },
    data: { usedAt: t },
  });
  if (spent.count !== 1) return null;
  const row = await db.loginToken.findUniqueOrThrow({ where: { hash } });
  const userId = row.userId ?? (await db.user.upsert({ where: { email: row.email }, create: { email: row.email }, update: {}, select: { id: true } })).id;
  return createSession(userId);
}
