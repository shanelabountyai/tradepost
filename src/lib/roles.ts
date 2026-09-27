import { notFound } from 'next/navigation';
import type { z } from 'zod';
import { orgAction } from '@/core/authz/action';
import type { OrgCtx } from '@/core/authz/guards';

// D-009 (F-01): inside a provider org, only an owner or admin moves money (accept, cancel, dispute) or
// changes listings. A `member` can read jobs and message the client. Kept out of the template's
// permission table because jobs and listings are this app's concepts, not the foundation's.

export const canManage = (ctx: Pick<OrgCtx, 'role'>) => ctx.role === 'owner' || ctx.role === 'admin';

/** An `orgAction` a `member` cannot run: it reads as notFound, like a missing permission (F-04). */
export const manageAction = <S extends z.ZodType, R>(schema: S, fn: (ctx: OrgCtx, input: z.infer<S>) => Promise<R>) =>
  orgAction(null, schema, (ctx, input) => (canManage(ctx) ? fn(ctx, input) : notFound()));
