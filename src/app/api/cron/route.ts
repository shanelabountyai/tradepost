import { isAuthorizedCron } from '@/core/cron';
import { log } from '@/core/log';
import { sweepRateLimits } from '@/core/rate-limit';
import { drainOutbox, sweepOutbox } from '@/modules/notifications/outbox';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return new Response(null, { status: 401 }); // no WWW-Authenticate: nothing to challenge
  const rateLimitsDeleted = await sweepRateLimits();
  const outbox = { ...(await drainOutbox()), swept: await sweepOutbox() };
  log('cron.done', { rateLimitsDeleted, ...outbox });
  return Response.json({ ok: true, rateLimitsDeleted, outbox }, { headers: { 'Cache-Control': 'no-store' } });
}
