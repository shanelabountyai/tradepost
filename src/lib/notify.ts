import { db } from '@/core/db';
import { log } from '@/core/log';
import { enqueue } from '@/modules/notifications/outbox';

// P1: job-request and message notifications, email only. Uses the template-owned outbox (queued,
// retried, drained hourly by cron) so a slow or failing provider never blocks the job/message action
// it rides along with — a notification failing must never look like the action itself failed.
async function send(to: string, orgId: string | undefined, subject: string, body: string) {
  try {
    await enqueue({ channel: 'email', to, template: 'notice', data: { subject, body }, orgId });
  } catch (e) {
    log('notify.failed', { subject, error: e instanceof Error ? e.message : String(e) }); // never the address (INV-13)
  }
}

export async function notifyClient(email: string, subject: string, body: string) {
  await send(email, undefined, subject, body);
}

/** Every owner/admin of the provider org (the same set that can act on its jobs, per canManage). */
export async function notifyProvider(orgId: string, subject: string, body: string) {
  const members = await db.membership.findMany({ where: { orgId, role: { in: ['owner', 'admin'] } }, select: { user: { select: { email: true } } } });
  await Promise.all(members.map((m) => send(m.user.email, orgId, subject, body)));
}
