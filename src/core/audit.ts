import { db } from '@/core/db';
import type { Prisma } from '@/generated/prisma/client';

type Tx = Prisma.TransactionClient;
export type AuditTarget = { targetType?: string; targetId?: string; data?: Prisma.InputJsonValue };

/**
 * Appends one event. Rows can never be changed or deleted (a DB trigger, INV-19), and carry no
 * foreign keys, so they outlive the org and user they name. Pass `tx` to commit with the change.
 */
export async function audit(actor: { orgId?: string | null; userId: string | null }, action: string, target: AuditTarget = {}, tx: Tx = db) {
  await tx.auditEvent.create({ data: { orgId: actor.orgId ?? null, actorUserId: actor.userId, action, ...target } });
}
