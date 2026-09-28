'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { notRef, userAction } from '@/core/authz/action';
import { requirePlatformAdmin } from '@/lib/admin';
import { settleDispute } from '@/lib/jobs';

// D-005: an admin works across providers, so the job id is not ref('job'). The harness's "another
// org's id is refused" (INV-02) is the opposite of this action's purpose; requirePlatformAdmin is the
// guard, and tests/integration/disputes.test.ts pins it.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dollars = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Enter the refund in dollars, like 42.50.');

export const resolveDispute = userAction(z.object({ jobId: notRef(z.string().regex(UUID)), refund: dollars }), async (s, i) => {
  const admin = await requirePlatformAdmin(s);
  const [whole, cents = ''] = i.refund.split('.');
  await settleDispute(i.jobId, admin.userId, Number(whole) * 100 + Number(cents.padEnd(2, '0')));
  redirect('/admin/disputes');
});
