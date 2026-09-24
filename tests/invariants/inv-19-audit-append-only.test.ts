import { beforeEach, describe, expect, it } from 'vitest';
import { audit } from '@/core/audit';
import { db } from '@/core/db';
import { resetAuthTables } from '../helpers/auth';

beforeEach(resetAuthTables);

describe('INV-19 AuditEvent is append-only', () => {
  it('rejects UPDATE and DELETE, even from raw SQL', async () => {
    await audit({ userId: null }, 'test.event');
    await expect(db.$executeRawUnsafe(`UPDATE "AuditEvent" SET "action" = 'forged'`)).rejects.toThrow(/append-only/);
    await expect(db.auditEvent.deleteMany()).rejects.toThrow(/append-only/);
    expect((await db.auditEvent.findFirstOrThrow()).action).toBe('test.event');
  });
});
