import { db } from '@/core/db';
import { log } from '@/core/log';
import { enqueue } from '@/modules/notifications/outbox';

// P1: job-request and message notifications, email only. Uses the template-owned outbox (queued,
// retried, drained hourly by cron) so a slow or failing provider never blocks the job/message action
// it rides along with — a notification failing must never look like the action itself failed.
async function send(channel: 'email' | 'sms', to: string, orgId: string | undefined, subject: string, body: string) {
  try {
    await enqueue({ channel, to, template: 'notice', data: { subject, body }, orgId });
  } catch (e) {
    log('notify.failed', { subject, error: e instanceof Error ? e.message : String(e) }); // never the address/number (INV-13)
  }
}

export async function notifyClient(email: string, subject: string, body: string) {
  await send('email', email, undefined, subject, body);
}

/**
 * Every owner/admin of the provider org (the same set that can act on its jobs, per canManage),
 * plus a second channel (D-021): if the org set a contact number, the same notice also goes by SMS.
 */
export async function notifyProvider(orgId: string, subject: string, body: string) {
  const [members, contact] = await Promise.all([
    db.membership.findMany({ where: { orgId, role: { in: ['owner', 'admin'] } }, select: { user: { select: { email: true } } } }),
    db.orgContact.findUnique({ where: { orgId }, select: { phone: true } }),
  ]);
  await Promise.all([
    ...members.map((m) => send('email', m.user.email, orgId, subject, body)),
    ...(contact ? [send('sms', contact.phone, orgId, subject, body)] : []),
  ]);
}
