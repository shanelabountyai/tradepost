import { env } from '@/core/env';
import { safeEqual } from '@/core/tokens';

/**
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Fails closed when the secret is unset
 * (INV-11), compares in constant time (INV-10), and reads the header only, never the URL (INV-16).
 */
export function isAuthorizedCron(req: Request, secret: string | undefined = env.CRON_SECRET): boolean {
  if (!secret) return false;
  return safeEqual(req.headers.get('authorization') ?? '', `Bearer ${secret}`);
}
