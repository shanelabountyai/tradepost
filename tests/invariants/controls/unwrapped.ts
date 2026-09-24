'use server';
// CONTROL (INV-01): a plain export. Anyone can call it.
import { db } from '@/core/db';

export async function revokeAll() {
  await db.invite.updateMany({ data: { revokedAt: new Date() } });
}
