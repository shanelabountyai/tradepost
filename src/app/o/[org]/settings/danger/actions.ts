'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { orgAction } from '@/core/authz/action';
import { deleteOrg } from '@/core/tenancy/delete';

export const destroyOrg = orgAction('org.delete', z.object({ confirm: z.string() }), async (ctx, { confirm }) => {
  await deleteOrg(ctx, confirm);
  redirect('/onboarding');
});
