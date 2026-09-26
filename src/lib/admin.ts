import { notFound, redirect } from 'next/navigation';
import { requireUser, type SessionCtx } from '@/core/auth/session';
import { db } from '@/core/db';

/**
 * D-005: platform admins resolve disputes across providers. Not an admin → notFound, so the surface
 * does not announce itself; an admin moves money, so MFA is required, as for an org owner (INV-22).
 */
export async function requirePlatformAdmin(s?: SessionCtx): Promise<SessionCtx> {
  const session = s ?? (await requireUser());
  if (!(await db.platformAdmin.findUnique({ where: { userId: session.userId } }))) notFound();
  if (!(session.totpEnrolled && session.mfaAt)) redirect('/account/security?mfa=required');
  return session;
}
