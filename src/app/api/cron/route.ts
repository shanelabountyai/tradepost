import { isAuthorizedCron } from '@/core/cron';
import { log } from '@/core/log';
import { sweepRateLimits } from '@/core/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return new Response(null, { status: 401 }); // no WWW-Authenticate: nothing to challenge
  const rateLimitsDeleted = await sweepRateLimits();
  log('cron.done', { rateLimitsDeleted });
  return Response.json({ ok: true, rateLimitsDeleted }, { headers: { 'Cache-Control': 'no-store' } });
}
