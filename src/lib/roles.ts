import { notFound } from 'next/navigation';
import type { z } from 'zod';
import { orgAction } from '@/core/authz/action';
import { requireOrg, type OrgCtx } from '@/core/authz/guards';

// D-009 (F-01): inside a provider org, only an owner or admin moves money (accept, cancel, dispute) or
// changes listings. A `member` can read jobs and message the client. Kept out of the template's
// permission table because jobs and listings are this app's concepts, not the foundation's.

export const canManage = (ctx: Pick<OrgCtx, 'role'>) => ctx.role === 'owner' || ctx.role === 'admin';

/**
 * An `orgAction` a `member` cannot run: it reads as notFound, like a missing permission (F-04). The role is
 * checked before the input is parsed (F-30), so a member learns nothing from a malformed input either.
 */
export const manageAction = <S extends z.ZodType, R>(schema: S, fn: (ctx: OrgCtx, input: z.infer<S>) => Promise<R>) => {
  const inner = orgAction(null, schema, (ctx, input) => (canManage(ctx) ? fn(ctx, input) : notFound()));
  const action = async (orgSlug: string, input: unknown) => {
    if (!canManage(await requireOrg(orgSlug))) notFound();
    return inner(orgSlug, input);
  };
  return Object.assign(action, { spec: inner.spec });
};
