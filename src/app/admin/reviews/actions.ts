'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { notRef, userAction } from '@/core/authz/action';
import { Refused } from '@/core/errors';
import { requirePlatformAdmin } from '@/lib/admin';
import { moderateReview } from '@/lib/tenancy';

// D-024 (F-16): an admin works across providers, so the review id is not ref() (same reasoning as
// resolveDispute); requirePlatformAdmin is the guard, and tests/integration/review-moderation.test.ts pins it.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const moderate = userAction(z.object({ reviewId: notRef(z.string().regex(UUID)), outcome: z.enum(['keep', 'hide']) }), async (s, i) => {
  const admin = await requirePlatformAdmin(s);
  if (!(await moderateReview(i.reviewId, admin.userId, i.outcome === 'hide'))) throw new Refused('This report was already handled.');
  redirect('/admin/reviews');
});
